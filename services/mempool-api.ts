/**
 * Mempool.space API Service
 * Documentation: https://mempool.space/docs/api/rest
 *
 * Supports: mainnet, testnet, testnet4, signet
 */

export type BitcoinNetwork = "mainnet" | "testnet" | "testnet4" | "signet";

const API_BASE_URLS: Record<BitcoinNetwork, string> = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
  signet: "https://mempool.space/signet/api",
};

// Default to testnet for development
const DEFAULT_NETWORK: BitcoinNetwork = "testnet";

/**
 * Address statistics
 */
export interface AddressStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

/**
 * Address details response
 */
export interface AddressInfo {
  address: string;
  chain_stats: AddressStats;
  mempool_stats: AddressStats;
}

/**
 * UTXO status
 */
export interface UtxoStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

/**
 * Unspent Transaction Output
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  status: UtxoStatus;
}

/**
 * Transaction input
 */
export interface TxInput {
  txid: string;
  vout: number;
  prevout: {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
  };
  scriptsig: string;
  scriptsig_asm: string;
  witness?: string[];
  is_coinbase: boolean;
  sequence: number;
}

/**
 * Transaction output
 */
export interface TxOutput {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
}

/**
 * Transaction status
 */
export interface TxStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

/**
 * Transaction details
 */
export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  vin: TxInput[];
  vout: TxOutput[];
  size: number;
  weight: number;
  fee: number;
  status: TxStatus;
}

/**
 * Fee estimates (sat/vB)
 */
export interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/**
 * Mempool API client
 */
export class MempoolApi {
  private baseUrl: string;
  private network: BitcoinNetwork;

  constructor(network: BitcoinNetwork = DEFAULT_NETWORK) {
    this.network = network;
    this.baseUrl = API_BASE_URLS[network];
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Mempool API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get address details including balance
   * GET /address/:address
   */
  async getAddress(address: string): Promise<AddressInfo> {
    return this.fetch<AddressInfo>(`/address/${address}`);
  }

  /**
   * Calculate address balance in satoshis
   */
  async getBalance(address: string): Promise<number> {
    const info = await this.getAddress(address);
    const chainBalance =
      info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
    const mempoolBalance =
      info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum;
    return chainBalance + mempoolBalance;
  }

  /**
   * Get address UTXOs
   * GET /address/:address/utxo
   */
  async getUtxos(address: string): Promise<UTXO[]> {
    return this.fetch<UTXO[]>(`/address/${address}/utxo`);
  }

  /**
   * Get confirmed UTXOs only
   */
  async getConfirmedUtxos(address: string): Promise<UTXO[]> {
    const utxos = await this.getUtxos(address);
    return utxos.filter((utxo) => utxo.status.confirmed);
  }

  /**
   * Get address transactions (up to 50 mempool + 25 confirmed)
   * GET /address/:address/txs
   */
  async getTransactions(address: string): Promise<Transaction[]> {
    return this.fetch<Transaction[]>(`/address/${address}/txs`);
  }

  /**
   * Get confirmed transactions with pagination
   * GET /address/:address/txs/chain/:last_seen_txid
   */
  async getConfirmedTransactions(
    address: string,
    lastSeenTxid?: string
  ): Promise<Transaction[]> {
    const endpoint = lastSeenTxid
      ? `/address/${address}/txs/chain/${lastSeenTxid}`
      : `/address/${address}/txs/chain`;
    return this.fetch<Transaction[]>(endpoint);
  }

  /**
   * Get mempool (unconfirmed) transactions
   * GET /address/:address/txs/mempool
   */
  async getMempoolTransactions(address: string): Promise<Transaction[]> {
    return this.fetch<Transaction[]>(`/address/${address}/txs/mempool`);
  }

  /**
   * Get transaction details by txid
   * GET /tx/:txid
   */
  async getTransaction(txid: string): Promise<Transaction> {
    return this.fetch<Transaction>(`/tx/${txid}`);
  }

  /**
   * Get raw transaction hex
   * GET /tx/:txid/hex
   */
  async getRawTransaction(txid: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/tx/${txid}/hex`);
    if (!response.ok) {
      throw new Error(`Failed to get raw transaction: ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Broadcast transaction
   * POST /tx
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/tx`, {
      method: "POST",
      body: txHex,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Broadcast failed: ${error}`);
    }

    return response.text(); // Returns txid
  }

  /**
   * Get recommended fees
   * GET /v1/fees/recommended
   */
  async getRecommendedFees(): Promise<FeeEstimates> {
    return this.fetch<FeeEstimates>("/v1/fees/recommended");
  }

  /**
   * Get current block height
   * GET /blocks/tip/height
   */
  async getBlockHeight(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/blocks/tip/height`);
    if (!response.ok) {
      throw new Error(`Failed to get block height: ${response.statusText}`);
    }
    return parseInt(await response.text(), 10);
  }
}

// Singleton instances for each network
export const mainnetApi = new MempoolApi("mainnet");
export const testnetApi = new MempoolApi("testnet");
export const testnet4Api = new MempoolApi("testnet4");
export const signetApi = new MempoolApi("signet");

// Default export for testnet
export default testnetApi;
