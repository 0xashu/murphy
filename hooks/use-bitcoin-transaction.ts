import { useCallback, useState, useRef } from "react";
import { useTurnkey, ClientState } from "@turnkey/react-native-wallet-kit";
import { TRANSACTION_TYPE_BITCOIN } from "@/constants/bitcoin";
import { isTaprootAddress, isTestnetAddress } from "@/utils/bitcoin";
import {
  buildPsbt,
  finalizePsbt,
  selectUtxos,
  type PsbtResult,
} from "@/services/psbt-builder";
import { MempoolApi, type UTXO } from "@/services/mempool-api";

export interface SignPsbtParams {
  /** Hex-encoded PSBT */
  psbtHex: string;
  /** Wallet account to sign with */
  walletAccount: {
    address: string;
  };
}

export interface SignMessageParams {
  /** Message to sign */
  message: string;
  /** Wallet account to sign with */
  walletAccount: {
    address: string;
  };
}

export interface TransactionSigningResult {
  /** Signed PSBT hex or signature */
  signature: string;
  /** Type of signature used (always Schnorr for Taproot) */
  signatureType: "Schnorr";
}

export interface SendBitcoinParams {
  /** Sender address */
  fromAddress: string;
  /** Recipient address */
  toAddress: string;
  /** Amount to send in satoshis */
  amount: number;
  /** Fee rate in sat/vB */
  feeRate: number;
  /** UTXOs available for spending */
  utxos: UTXO[];
}

export interface SendBitcoinResult {
  /** Transaction ID (txid) */
  txid: string;
  /** Raw transaction hex */
  rawTx: string;
  /** Fee paid in satoshis */
  fee: number;
  /** Change amount in satoshis */
  change: number;
}

export interface TransactionState {
  /** Current step in the transaction process */
  step: "idle" | "building" | "signing" | "broadcasting" | "complete" | "error";
  /** Error message if step is "error" */
  error?: string;
  /** PSBT result from building step */
  psbtResult?: PsbtResult;
  /** Final transaction result */
  txResult?: SendBitcoinResult;
}

/**
 * Hook for Bitcoin transaction signing and sending (Taproot only)
 * Handles PSBT building, signing with Turnkey, and broadcasting
 * Auto-detects network from address (mainnet vs testnet)
 */
export function useBitcoinTransaction() {
  const { signMessage, signTransaction, clientState } = useTurnkey();
  const [txState, setTxState] = useState<TransactionState>({ step: "idle" });

  // Create API instances for all networks
  const mainnetApi = useRef(new MempoolApi("mainnet")).current;
  const signetApi = useRef(new MempoolApi("signet")).current;

  // Get the appropriate API based on address
  // tb1p/tb1q = signet (for development), bc1p/bc1q = mainnet
  const getApiForAddress = useCallback((address: string) => {
    if (isTestnetAddress(address)) {
      return signetApi;
    }
    return mainnetApi;
  }, [mainnetApi, signetApi]);

  const isReady = clientState === ClientState.Ready;

  /**
   * Reset transaction state
   */
  const resetTxState = useCallback(() => {
    setTxState({ step: "idle" });
  }, []);

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   * Uses Schnorr signatures for Taproot
   */
  const signPsbt = useCallback(
    async (params: SignPsbtParams): Promise<TransactionSigningResult> => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      const { psbtHex, walletAccount } = params;

      if (!isTaprootAddress(walletAccount.address)) {
        throw new Error("Only Taproot addresses are supported");
      }

      try {
        const signedPsbt = await signTransaction({
          unsignedTransaction: psbtHex,
          transactionType: TRANSACTION_TYPE_BITCOIN,
          walletAccount: walletAccount as any,
        });

        return {
          signature: signedPsbt,
          signatureType: "Schnorr",
        };
      } catch (error) {
        console.error("Error signing PSBT:", error);
        throw error;
      }
    },
    [isReady, signTransaction]
  );

  /**
   * Sign a message with Bitcoin address (Schnorr signature)
   */
  const signBitcoinMessage = useCallback(
    async (params: SignMessageParams): Promise<TransactionSigningResult> => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      const { message, walletAccount } = params;

      if (!isTaprootAddress(walletAccount.address)) {
        throw new Error("Only Taproot addresses are supported");
      }

      try {
        const signature = await signMessage({
          message,
          walletAccount: walletAccount as any,
        });

        return {
          signature:
            typeof signature === "string"
              ? signature
              : JSON.stringify(signature),
          signatureType: "Schnorr",
        };
      } catch (error) {
        console.error("Error signing message:", error);
        throw error;
      }
    },
    [isReady, signMessage]
  );

  /**
   * Get signing info for an address (always Taproot/Schnorr)
   */
  const getSigningInfo = useCallback((address: string) => {
    if (!isTaprootAddress(address)) {
      throw new Error("Only Taproot addresses are supported");
    }
    return {
      isTaproot: true,
      signatureType: "Schnorr" as const,
      sighashDefault: "SIGHASH_DEFAULT",
    };
  }, []);

  /**
   * Estimate fee for a transaction
   */
  const estimateFee = useCallback(
    (
      utxos: UTXO[],
      fromAddress: string,
      toAddress: string,
      amount: number,
      feeRate: number
    ): { fee: number; change: number } | null => {
      const selection = selectUtxos(
        utxos.filter((u) => u.status.confirmed),
        amount,
        feeRate,
        fromAddress,
        toAddress
      );

      if (!selection) {
        return null;
      }

      return {
        fee: selection.fee,
        change: selection.change,
      };
    },
    []
  );

  /**
   * Send Bitcoin - Full flow: Build PSBT -> Sign with Turnkey -> Broadcast
   */
  const sendBitcoin = useCallback(
    async (params: SendBitcoinParams): Promise<SendBitcoinResult> => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      const { fromAddress, toAddress, amount, feeRate, utxos } = params;

      if (!isTaprootAddress(fromAddress)) {
        throw new Error("Only Taproot addresses are supported");
      }

      try {
        // Step 1: Build PSBT
        setTxState({ step: "building" });

        const psbtResult = buildPsbt({
          utxos,
          senderAddress: fromAddress,
          recipientAddress: toAddress,
          amount,
          feeRate,
        });

        setTxState({ step: "signing", psbtResult });

        // Step 2: Sign with Turnkey
        const signResult = await signPsbt({
          psbtHex: psbtResult.psbtHex,
          walletAccount: { address: fromAddress },
        });

        setTxState({ step: "broadcasting", psbtResult });

        // Step 3: Finalize PSBT and extract raw transaction
        const rawTx = finalizePsbt(signResult.signature);

        // Step 4: Broadcast to network
        const api = getApiForAddress(fromAddress);
        const txid = await api.broadcastTransaction(rawTx);

        const result: SendBitcoinResult = {
          txid,
          rawTx,
          fee: psbtResult.fee,
          change: psbtResult.change,
        };

        setTxState({
          step: "complete",
          psbtResult,
          txResult: result,
        });

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Transaction failed";
        setTxState({ step: "error", error: errorMessage });
        throw error;
      }
    },
    [isReady, signPsbt, getApiForAddress]
  );

  /**
   * Build PSBT without signing (for preview)
   */
  const buildTransaction = useCallback(
    (params: Omit<SendBitcoinParams, "publicKey">): PsbtResult => {
      const { fromAddress, toAddress, amount, feeRate, utxos } = params;

      return buildPsbt({
        utxos,
        senderAddress: fromAddress,
        recipientAddress: toAddress,
        amount,
        feeRate,
      });
    },
    []
  );

  /**
   * Broadcast a signed transaction
   */
  const broadcastTransaction = useCallback(
    async (rawTxHex: string, fromAddress?: string): Promise<string> => {
      setTxState({ step: "broadcasting" });

      try {
        // Use mainnet by default if no address provided
        const api = fromAddress ? getApiForAddress(fromAddress) : mainnetApi;
        const txid = await api.broadcastTransaction(rawTxHex);
        setTxState({
          step: "complete",
          txResult: { txid, rawTx: rawTxHex, fee: 0, change: 0 },
        });
        return txid;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Broadcast failed";
        setTxState({ step: "error", error: errorMessage });
        throw error;
      }
    },
    [getApiForAddress, mainnetApi]
  );

  return {
    // State
    isReady,
    txState,

    // Transaction operations
    sendBitcoin,
    buildTransaction,
    broadcastTransaction,
    resetTxState,

    // Signing operations
    signPsbt,
    signMessage: signBitcoinMessage,

    // Utilities
    getSigningInfo,
    estimateFee,
  };
}
