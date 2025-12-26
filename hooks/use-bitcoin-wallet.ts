import { useCallback, useMemo } from "react";
import { useTurnkey, ClientState } from "@turnkey/react-native-wallet-kit";
import { BitcoinAddressFormat } from "@/constants/bitcoin";
import { getBitcoinAddressType, isTaprootAddress } from "@/utils/bitcoin";

export interface CreateBitcoinWalletOptions {
  walletName?: string;
  isTestnet?: boolean;
}

export interface BitcoinAccount {
  address: string;
  addressType: string;
  signatureType: "Schnorr";
}

export interface BitcoinWallet {
  walletId: string;
  walletName: string;
  accounts: BitcoinAccount[];
}

/**
 * Hook for managing Bitcoin wallets (Taproot only)
 * Handles wallet creation, account management, and exports
 */
export function useBitcoinWallet() {
  const {
    wallets,
    createWallet,
    createWalletAccounts,
    refreshWallets,
    exportWallet,
    exportWalletAccount,
    clientState,
  } = useTurnkey();

  const isReady = clientState === ClientState.Ready;

  // Create a new Bitcoin wallet with Taproot address
  const createBitcoinWallet = useCallback(
    async (options: CreateBitcoinWalletOptions = {}) => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      const {
        walletName = `Bitcoin Wallet ${wallets.length + 1}`,
        isTestnet = false,
      } = options;

      const addressFormat = isTestnet
        ? BitcoinAddressFormat.TESTNET_P2TR
        : BitcoinAddressFormat.MAINNET_P2TR;

      try {
        const walletId = await createWallet({
          walletName,
          accounts: [addressFormat],
        });

        await refreshWallets();
        return walletId;
      } catch (error) {
        console.error("Error creating Bitcoin wallet:", error);
        throw error;
      }
    },
    [isReady, wallets.length, createWallet, refreshWallets]
  );

  // Add Taproot account to existing wallet
  const addAccount = useCallback(
    async (walletId: string, isTestnet = false) => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      const addressFormat = isTestnet
        ? BitcoinAddressFormat.TESTNET_P2TR
        : BitcoinAddressFormat.MAINNET_P2TR;

      try {
        const addresses = await createWalletAccounts({
          walletId,
          accounts: [addressFormat],
        });

        await refreshWallets();
        return addresses;
      } catch (error) {
        console.error("Error adding account:", error);
        throw error;
      }
    },
    [isReady, createWalletAccounts, refreshWallets]
  );

  // Export wallet mnemonic
  const exportWalletMnemonic = useCallback(
    async (walletId: string) => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      try {
        const mnemonic = await exportWallet({ walletId });
        return mnemonic;
      } catch (error) {
        console.error("Error exporting wallet:", error);
        throw error;
      }
    },
    [isReady, exportWallet]
  );

  // Export account private key
  const exportAccountPrivateKey = useCallback(
    async (address: string) => {
      if (!isReady) {
        throw new Error("Client not ready");
      }

      try {
        const privateKey = await exportWalletAccount({ address });
        return privateKey;
      } catch (error) {
        console.error("Error exporting account:", error);
        throw error;
      }
    },
    [isReady, exportWalletAccount]
  );

  // Transform wallets to Bitcoin-specific format, filtering only Taproot accounts
  const bitcoinWallets: BitcoinWallet[] = useMemo(() => {
    return wallets
      .map((wallet) => {
        // Filter only Taproot accounts
        const taprootAccounts = (wallet.accounts || [])
          .filter((account) => isTaprootAddress(account.address))
          .map((account) => ({
            address: account.address,
            addressType: getBitcoinAddressType(account.address),
            signatureType: "Schnorr" as const,
          }));

        return {
          walletId: wallet.walletId,
          walletName: wallet.walletName || "Unnamed Wallet",
          accounts: taprootAccounts,
        };
      })
      // Only include wallets that have Taproot accounts
      .filter((wallet) => wallet.accounts.length > 0);
  }, [wallets]);

  return {
    // State
    wallets: bitcoinWallets,
    isReady,

    // Wallet operations
    createWallet: createBitcoinWallet,
    addAccount,
    refreshWallets,

    // Export operations
    exportWalletMnemonic,
    exportAccountPrivateKey,
  };
}
