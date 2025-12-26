import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AccountCard } from "./account-card";
import type { BitcoinWallet, BitcoinAccount } from "@/hooks/use-bitcoin-wallet";

interface WalletCardProps {
  wallet: BitcoinWallet;
  disabled?: boolean;
  onExportWallet?: () => void;
  onSignMessage?: (account: BitcoinAccount) => void;
  onSignTransaction?: (account: BitcoinAccount) => void;
  onExportAccount?: (account: BitcoinAccount) => void;
}

export function WalletCard({
  wallet,
  disabled = false,
  onExportWallet,
  onSignMessage,
  onSignTransaction,
  onExportAccount,
}: WalletCardProps) {
  return (
    <ThemedView style={styles.container}>
      {/* Wallet Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <ThemedText type="defaultSemiBold">{wallet.walletName}</ThemedText>
          <ThemedText style={styles.walletId}>
            ID: {wallet.walletId.slice(0, 8)}...
          </ThemedText>
        </View>
        {onExportWallet && (
          <TouchableOpacity
            style={[styles.exportWalletButton, disabled && styles.disabled]}
            disabled={disabled}
            onPress={onExportWallet}
          >
            <ThemedText style={styles.exportButtonText}>Export</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Accounts */}
      {wallet.accounts.length > 0 && (
        <View style={styles.accountsSection}>
          <ThemedText style={styles.accountsHeader}>
            Accounts ({wallet.accounts.length})
          </ThemedText>
          <View style={styles.accountsList}>
            {wallet.accounts.map((account, index) => (
              <AccountCard
                key={`${wallet.walletId}-${index}`}
                account={account}
                disabled={disabled}
                onSignMessage={
                  onSignMessage ? () => onSignMessage(account) : undefined
                }
                onSignTransaction={
                  onSignTransaction
                    ? () => onSignTransaction(account)
                    : undefined
                }
                onExport={
                  onExportAccount ? () => onExportAccount(account) : undefined
                }
              />
            ))}
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.5)",
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerInfo: {
    flex: 1,
  },
  walletId: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  exportWalletButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  exportButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  accountsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  accountsHeader: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  accountsList: {
    gap: 12,
  },
  disabled: {
    opacity: 0.6,
  },
});
