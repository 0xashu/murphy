import { useState, useCallback, useEffect, useRef } from "react";
import {
  MempoolApi,
  type UTXO,
  type Transaction,
  type FeeEstimates,
  type BitcoinNetwork,
} from "@/services/mempool-api";
import { isTestnetAddress } from "@/utils/bitcoin";

export interface AddressData {
  address: string;
  balance: number; // in satoshis
  utxos: UTXO[];
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
}

export interface BitcoinDataState {
  addresses: Record<string, AddressData>;
  totalBalance: number;
  fees: FeeEstimates | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: BitcoinDataState = {
  addresses: {},
  totalBalance: 0,
  fees: null,
  isLoading: false,
  error: null,
};

/**
 * Hook for fetching Bitcoin blockchain data from Mempool.space API
 * Manages balance, UTXOs, transactions, and fee estimates
 * Auto-detects network from address (mainnet vs testnet)
 */
export function useBitcoinData(defaultNetwork: BitcoinNetwork = "mainnet") {
  const [state, setState] = useState<BitcoinDataState>(initialState);

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

  // Get default API for fee estimates
  const defaultApi = defaultNetwork === "testnet" ? signetApi : mainnetApi;

  /**
   * Fetch data for a single address
   */
  const fetchAddressData = useCallback(
    async (address: string): Promise<AddressData> => {
      const api = getApiForAddress(address);
      const isTestnet = isTestnetAddress(address);

      console.log(`[Bitcoin] Fetching data for ${address}`);
      console.log(`[Bitcoin] Network: ${isTestnet ? "testnet" : "mainnet"}`);

      try {
        const [balance, utxos, transactions] = await Promise.all([
          api.getBalance(address),
          api.getUtxos(address),
          api.getTransactions(address),
        ]);

        console.log(`[Bitcoin] ${address.slice(0, 12)}... - Balance: ${balance}, UTXOs: ${utxos.length}, Txs: ${transactions.length}`);

        return {
          address,
          balance,
          utxos,
          transactions,
          isLoading: false,
          error: null,
        };
      } catch (error) {
        console.error(`[Bitcoin] Error fetching data for ${address}:`, error);
        return {
          address,
          balance: 0,
          utxos: [],
          transactions: [],
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch data",
        };
      }
    },
    [getApiForAddress]
  );

  /**
   * Fetch data for multiple addresses
   */
  const fetchAllAddresses = useCallback(
    async (addresses: string[]) => {
      if (addresses.length === 0) return;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Fetch data for all addresses in parallel
        const results = await Promise.all(
          addresses.map((addr) => fetchAddressData(addr))
        );

        // Build address map and calculate total
        const addressMap: Record<string, AddressData> = {};
        let total = 0;

        results.forEach((data) => {
          addressMap[data.address] = data;
          total += data.balance;
        });

        // Also fetch fee estimates (use API based on first address network)
        const feesApi = addresses.length > 0 ? getApiForAddress(addresses[0]) : defaultApi;
        const fees = await feesApi.getRecommendedFees();

        setState({
          addresses: addressMap,
          totalBalance: total,
          fees,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error fetching Bitcoin data:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch data",
        }));
      }
    },
    [getApiForAddress, defaultApi, fetchAddressData]
  );

  /**
   * Refresh data for a single address
   */
  const refreshAddress = useCallback(
    async (address: string) => {
      setState((prev) => ({
        ...prev,
        addresses: {
          ...prev.addresses,
          [address]: {
            ...prev.addresses[address],
            isLoading: true,
          },
        },
      }));

      const data = await fetchAddressData(address);

      setState((prev) => {
        const newAddresses = {
          ...prev.addresses,
          [address]: data,
        };

        // Recalculate total
        const newTotal = Object.values(newAddresses).reduce(
          (sum, addr) => sum + addr.balance,
          0
        );

        return {
          ...prev,
          addresses: newAddresses,
          totalBalance: newTotal,
        };
      });
    },
    [fetchAddressData]
  );

  /**
   * Refresh fee estimates
   */
  const refreshFees = useCallback(async (address?: string) => {
    try {
      const api = address ? getApiForAddress(address) : defaultApi;
      const fees = await api.getRecommendedFees();
      setState((prev) => ({ ...prev, fees }));
      return fees;
    } catch (error) {
      console.error("Error fetching fees:", error);
      return null;
    }
  }, [getApiForAddress, defaultApi]);

  /**
   * Get UTXOs for transaction building
   * Returns confirmed UTXOs sorted by value (largest first)
   */
  const getUtxosForSpending = useCallback(
    (address: string, minConfirmations = 1): UTXO[] => {
      const addressData = state.addresses[address];
      if (!addressData) return [];

      return addressData.utxos
        .filter((utxo) => {
          if (!utxo.status.confirmed) return false;
          // For now, we accept all confirmed UTXOs
          // In production, you might want to check block depth
          return true;
        })
        .sort((a, b) => b.value - a.value);
    },
    [state.addresses]
  );

  /**
   * Calculate total available balance for spending (confirmed only)
   */
  const getSpendableBalance = useCallback(
    (address: string): number => {
      const utxos = getUtxosForSpending(address);
      return utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    },
    [getUtxosForSpending]
  );

  /**
   * Select UTXOs to cover a target amount + fees
   * Uses simple largest-first coin selection
   */
  const selectUtxos = useCallback(
    (
      address: string,
      targetAmount: number,
      feeRate: number
    ): { utxos: UTXO[]; fee: number; change: number } | null => {
      const availableUtxos = getUtxosForSpending(address);
      const selectedUtxos: UTXO[] = [];
      let totalInput = 0;

      // Estimate transaction size (rough estimate)
      // P2WPKH input: ~68 vbytes, output: ~31 vbytes
      const INPUT_SIZE = 68;
      const OUTPUT_SIZE = 31;
      const BASE_TX_SIZE = 10;

      for (const utxo of availableUtxos) {
        selectedUtxos.push(utxo);
        totalInput += utxo.value;

        // Calculate fee for current selection
        // 1 output for recipient, 1 for change
        const txSize =
          BASE_TX_SIZE + selectedUtxos.length * INPUT_SIZE + 2 * OUTPUT_SIZE;
        const fee = Math.ceil(txSize * feeRate);

        if (totalInput >= targetAmount + fee) {
          const change = totalInput - targetAmount - fee;
          return {
            utxos: selectedUtxos,
            fee,
            change: change > 546 ? change : 0, // Dust threshold
          };
        }
      }

      // Not enough funds
      return null;
    },
    [getUtxosForSpending]
  );

  /**
   * Broadcast a signed transaction
   */
  const broadcastTransaction = useCallback(
    async (txHex: string, address?: string): Promise<string> => {
      const api = address ? getApiForAddress(address) : defaultApi;
      return api.broadcastTransaction(txHex);
    },
    [getApiForAddress, defaultApi]
  );

  /**
   * Get transaction details by txid
   */
  const getTransaction = useCallback(
    async (txid: string, address?: string) => {
      const api = address ? getApiForAddress(address) : defaultApi;
      return api.getTransaction(txid);
    },
    [getApiForAddress, defaultApi]
  );

  return {
    // State
    ...state,

    // Actions
    fetchAllAddresses,
    refreshAddress,
    refreshFees,

    // Utilities
    getUtxosForSpending,
    getSpendableBalance,
    selectUtxos,

    // API operations
    broadcastTransaction,
    getTransaction,

    // Network info
    defaultNetwork,
    getApiForAddress,
  };
}

/**
 * Format satoshis to BTC string
 */
export function satoshisToBtc(satoshis: number): string {
  return (satoshis / 100_000_000).toFixed(8);
}

/**
 * Format satoshis to display string with unit
 */
export function formatSatoshis(
  satoshis: number,
  showUnit = true
): string {
  if (satoshis >= 100_000_000) {
    // Show in BTC
    const btc = satoshis / 100_000_000;
    return `${btc.toFixed(8)}${showUnit ? " BTC" : ""}`;
  } else if (satoshis >= 1000) {
    // Show in mBTC or sats
    return `${satoshis.toLocaleString()}${showUnit ? " sats" : ""}`;
  } else {
    return `${satoshis}${showUnit ? " sats" : ""}`;
  }
}

/**
 * Parse BTC string to satoshis
 */
export function btcToSatoshis(btc: string | number): number {
  const value = typeof btc === "string" ? parseFloat(btc) : btc;
  return Math.round(value * 100_000_000);
}
