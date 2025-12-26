/**
 * PSBT Builder Service (Taproot Only)
 * Uses bitcoinjs-lib to construct Partially Signed Bitcoin Transactions
 */

import * as bitcoin from "bitcoinjs-lib";
import type { UTXO } from "./mempool-api";
import { isTaprootAddress, isTestnetAddress } from "@/utils/bitcoin";

// Taproot input/output size estimates (in virtual bytes)
const P2TR_INPUT_SIZE = 58;
const P2TR_OUTPUT_SIZE = 43;
const BASE_TX_SIZE = 10; // Version + locktime overhead

// Minimum output value in satoshis (dust threshold)
// Outputs below this value are rejected by the network
export const DUST_THRESHOLD = 546;

export interface BuildPsbtParams {
  /** UTXOs to spend */
  utxos: UTXO[];
  /** Sender address (for change) */
  senderAddress: string;
  /** Recipient address */
  recipientAddress: string;
  /** Amount to send in satoshis */
  amount: number;
  /** Fee rate in sat/vB */
  feeRate: number;
}

export interface PsbtResult {
  /** PSBT in hex format */
  psbtHex: string;
  /** PSBT in base64 format */
  psbtBase64: string;
  /** Calculated fee in satoshis */
  fee: number;
  /** Change amount in satoshis (0 if no change output) */
  change: number;
  /** Total input amount */
  totalInput: number;
  /** Number of inputs */
  inputCount: number;
  /** Number of outputs */
  outputCount: number;
}

export interface CoinSelectionResult {
  /** Selected UTXOs */
  utxos: UTXO[];
  /** Total value of selected UTXOs */
  totalValue: number;
  /** Calculated fee */
  fee: number;
  /** Change amount */
  change: number;
}

/**
 * Get the appropriate network for bitcoinjs-lib
 */
export function getNetwork(address: string): bitcoin.Network {
  return isTestnetAddress(address)
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin;
}

/**
 * Estimate transaction size in virtual bytes (Taproot only)
 */
export function estimateTxSize(
  inputCount: number,
  includeChange: boolean
): number {
  const outputCount = includeChange ? 2 : 1;
  return BASE_TX_SIZE + inputCount * P2TR_INPUT_SIZE + outputCount * P2TR_OUTPUT_SIZE;
}

/**
 * Select UTXOs to cover target amount + estimated fees
 * Uses a simple largest-first strategy
 */
export function selectUtxos(
  availableUtxos: UTXO[],
  targetAmount: number,
  feeRate: number,
  senderAddress: string,
  recipientAddress: string
): CoinSelectionResult | null {
  // Only use Taproot UTXOs
  if (!isTaprootAddress(senderAddress)) {
    throw new Error("Only Taproot addresses are supported");
  }

  // Sort by value (largest first)
  const sortedUtxos = [...availableUtxos].sort((a, b) => b.value - a.value);

  const selectedUtxos: UTXO[] = [];
  let totalValue = 0;

  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo);
    totalValue += utxo.value;

    // Estimate fee with current selection
    const txSizeWithChange = estimateTxSize(selectedUtxos.length, true);
    const feeWithChange = Math.ceil(txSizeWithChange * feeRate);

    const txSizeNoChange = estimateTxSize(selectedUtxos.length, false);
    const feeNoChange = Math.ceil(txSizeNoChange * feeRate);

    // Check if we have enough
    if (totalValue >= targetAmount + feeWithChange) {
      const change = totalValue - targetAmount - feeWithChange;

      // If change is dust, don't include it
      if (change < DUST_THRESHOLD) {
        // Recalculate fee without change
        if (totalValue >= targetAmount + feeNoChange) {
          return {
            utxos: selectedUtxos,
            totalValue,
            fee: totalValue - targetAmount, // All remainder goes to fee
            change: 0,
          };
        }
      } else {
        return {
          utxos: selectedUtxos,
          totalValue,
          fee: feeWithChange,
          change,
        };
      }
    }
  }

  // Not enough funds
  return null;
}

/**
 * Build a PSBT for a Bitcoin transaction (Taproot only)
 */
export function buildPsbt(params: BuildPsbtParams): PsbtResult {
  const {
    utxos,
    senderAddress,
    recipientAddress,
    amount,
    feeRate,
  } = params;

  // Validate Taproot addresses
  if (!isTaprootAddress(senderAddress)) {
    throw new Error("Sender must be a Taproot address (bc1p.../tb1p...)");
  }

  // Validate amount is above dust threshold
  if (amount < DUST_THRESHOLD) {
    throw new Error(`Amount too small. Minimum is ${DUST_THRESHOLD} satoshis (${DUST_THRESHOLD / 100_000_000} BTC)`);
  }

  // Determine network
  const network = getNetwork(senderAddress);

  // Select UTXOs
  const selection = selectUtxos(
    utxos.filter((u) => u.status.confirmed), // Only confirmed UTXOs
    amount,
    feeRate,
    senderAddress,
    recipientAddress
  );

  if (!selection) {
    throw new Error("Insufficient funds");
  }

  // Create PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Add inputs (Taproot)
  for (const utxo of selection.utxos) {
    // Get output script from address
    const outputScript = bitcoin.address.toOutputScript(senderAddress, network);

    const inputData: any = {
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: outputScript,
        value: BigInt(utxo.value),
      },
    };

    // Note: We don't set tapInternalKey here - Turnkey will add it during signing
    // Setting it here causes "duplicate data" error when Turnkey processes the PSBT

    psbt.addInput(inputData);
  }

  // Add recipient output
  psbt.addOutput({
    address: recipientAddress,
    value: BigInt(amount),
  });

  // Add change output if needed
  if (selection.change > 0) {
    psbt.addOutput({
      address: senderAddress,
      value: BigInt(selection.change),
    });
  }

  return {
    psbtHex: psbt.toHex(),
    psbtBase64: psbt.toBase64(),
    fee: selection.fee,
    change: selection.change,
    totalInput: selection.totalValue,
    inputCount: selection.utxos.length,
    outputCount: selection.change > 0 ? 2 : 1,
  };
}

/**
 * Finalize and extract transaction from signed PSBT
 */
export function finalizePsbt(signedPsbtHex: string): string {
  const psbt = bitcoin.Psbt.fromHex(signedPsbtHex);

  // Finalize all inputs
  psbt.finalizeAllInputs();

  // Extract transaction
  const tx = psbt.extractTransaction();

  return tx.toHex();
}

/**
 * Calculate fee for a Taproot transaction
 */
export function calculateFee(
  inputCount: number,
  includeChange: boolean,
  feeRate: number
): number {
  const txSize = estimateTxSize(inputCount, includeChange);
  return Math.ceil(txSize * feeRate);
}

/**
 * Validate PSBT hex string
 */
export function validatePsbt(psbtHex: string): boolean {
  try {
    bitcoin.Psbt.fromHex(psbtHex);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse PSBT and extract details
 */
export function parsePsbt(psbtHex: string): {
  inputCount: number;
  outputCount: number;
  totalInput: number;
  totalOutput: number;
  fee: number;
} {
  const psbt = bitcoin.Psbt.fromHex(psbtHex);

  let totalInput = 0;
  let totalOutput = 0;

  // Sum inputs (from witness UTXOs)
  for (const input of psbt.data.inputs) {
    if (input.witnessUtxo) {
      totalInput += Number(input.witnessUtxo.value);
    }
  }

  // Sum outputs
  for (const output of psbt.txOutputs) {
    totalOutput += Number(output.value);
  }

  return {
    inputCount: psbt.inputCount,
    outputCount: psbt.txOutputs.length,
    totalInput,
    totalOutput,
    fee: totalInput - totalOutput,
  };
}
