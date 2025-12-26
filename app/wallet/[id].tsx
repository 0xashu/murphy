import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBitcoinWallet, type BitcoinAccount } from "@/hooks/use-bitcoin-wallet";
import { useBitcoinTransaction } from "@/hooks/use-bitcoin-transaction";
import { useSecureAction } from "@/hooks/use-secure-action";
import { isTestnetAddress } from "@/utils/bitcoin";

export default function WalletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    wallets,
    isReady,
    addAccount,
    exportWalletMnemonic,
    exportAccountPrivateKey,
  } = useBitcoinWallet();

  const { signMessage, getSigningInfo } = useBitcoinTransaction();
  const { exportMnemonic, exportPrivateKey, signMessage: secureSignMessage, isAuthenticating } = useSecureAction();

  // Find the wallet
  const wallet = wallets.find((w) => w.walletId === id);

  // Detect if wallet uses testnet (from first account)
  const isTestnet = wallet?.accounts[0]?.address
    ? isTestnetAddress(wallet.accounts[0].address)
    : false;

  if (!wallet) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: "Wallet Not Found" }} />
        <ThemedView style={styles.centered}>
          <ThemedText>Wallet not found</ThemedText>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  // Add Taproot Account
  const handleAddTaproot = useCallback(async () => {
    try {
      await addAccount(wallet.walletId, isTestnet);
      Alert.alert("Success", "Taproot account added");
    } catch (error) {
      console.error("Error adding Taproot account:", error);
      Alert.alert("Error", "Failed to add account");
    }
  }, [addAccount, wallet.walletId, isTestnet]);

  // Export Wallet with biometric verification
  const handleExportWallet = useCallback(async () => {
    const result = await exportMnemonic(async () => {
      return await exportWalletMnemonic(wallet.walletId);
    });

    if (result.success && result.result) {
      Alert.alert("Mnemonic Phrase", String(result.result), [
        {
          text: "Copy",
          onPress: () => Clipboard.setStringAsync(String(result.result)),
        },
        { text: "Close" },
      ]);
    } else if (result.error && result.error !== "User cancelled") {
      Alert.alert("Error", result.error);
    }
  }, [exportMnemonic, exportWalletMnemonic, wallet.walletId]);

  // Account Actions
  const handleSignMessage = useCallback(
    async (account: BitcoinAccount) => {
      const result = await secureSignMessage(async () => {
        return await signMessage({
          message: "Hello, Bitcoin!",
          walletAccount: { address: account.address },
        });
      });

      if (result.success && result.result) {
        Alert.alert(
          `Signed with ${result.result.signatureType}`,
          `Signature: ${result.result.signature.slice(0, 40)}...`
        );
      } else if (result.error && result.error !== "User cancelled") {
        Alert.alert("Error", result.error);
      }
    },
    [secureSignMessage, signMessage]
  );

  const handleSignTransaction = useCallback(
    (account: BitcoinAccount) => {
      const info = getSigningInfo(account.address);
      Alert.alert(
        "Sign Transaction",
        `Address: ${account.addressType}\n` +
          `Signature Type: ${info.signatureType}\n` +
          `Sighash: ${info.sighashDefault}\n\n` +
          `Use the Transaction tab to send Bitcoin.`
      );
    },
    [getSigningInfo]
  );

  const handleExportAccount = useCallback(
    async (account: BitcoinAccount) => {
      const result = await exportPrivateKey(async () => {
        return await exportAccountPrivateKey(account.address);
      });

      if (result.success && result.result) {
        Alert.alert(`${account.addressType} Private Key`, String(result.result), [
          {
            text: "Copy",
            onPress: () => Clipboard.setStringAsync(String(result.result)),
          },
          { text: "Close" },
        ]);
      } else if (result.error && result.error !== "User cancelled") {
        Alert.alert("Error", result.error);
      }
    },
    [exportPrivateKey, exportAccountPrivateKey]
  );

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: wallet.walletName,
        }}
      />

      <ThemedView style={styles.content}>
        {/* Authenticating Overlay */}
        {isAuthenticating && (
          <View style={styles.authOverlay}>
            <ActivityIndicator size="large" color="#f7931a" />
            <ThemedText style={styles.authText}>Authenticating...</ThemedText>
          </View>
        )}

        {/* Wallet Info */}
        <ThemedView style={styles.walletInfo}>
          <ThemedText type="title">{wallet.walletName}</ThemedText>
          <ThemedText style={styles.walletId}>
            {wallet.walletId.slice(0, 16)}...{wallet.walletId.slice(-8)}
          </ThemedText>
          <View style={styles.networkBadge}>
            <Text style={styles.networkBadgeText}>
              {isTestnet ? "Signet" : "Mainnet"} - Taproot
            </Text>
          </View>
          <ThemedText style={styles.accountCount}>
            {wallet.accounts.length} account{wallet.accounts.length !== 1 ? "s" : ""}
          </ThemedText>
        </ThemedView>

        {/* Security Notice */}
        <ThemedView style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🔒</Text>
          <ThemedText style={styles.securityText}>
            Sensitive operations require biometric verification
          </ThemedText>
        </ThemedView>

        {/* Export Wallet */}
        <TouchableOpacity
          style={[styles.exportButton, !isReady && styles.disabled]}
          disabled={!isReady}
          onPress={handleExportWallet}
        >
          <ThemedText style={styles.exportButtonText}>
            Export Mnemonic
          </ThemedText>
          <Text style={styles.exportButtonIcon}>🔐</Text>
        </TouchableOpacity>

        {/* Add Account Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Add Account</ThemedText>
          <TouchableOpacity
            style={[styles.addButton, !isReady && styles.disabled]}
            disabled={!isReady}
            onPress={handleAddTaproot}
          >
            <ThemedText style={styles.addButtonText}>+ Add Taproot Account</ThemedText>
            <ThemedText style={styles.addButtonSubtext}>
              {isTestnet ? "tb1p..." : "bc1p..."} (BIP86)
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Accounts List with Full Addresses */}
        {wallet.accounts.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Accounts</ThemedText>
            <View style={styles.accountsList}>
              {wallet.accounts.map((account, index) => (
                <AddressAccountCard
                  key={`${wallet.walletId}-${index}`}
                  account={account}
                  disabled={!isReady}
                  onSignMessage={() => handleSignMessage(account)}
                  onSignTransaction={() => handleSignTransaction(account)}
                  onExport={() => handleExportAccount(account)}
                />
              ))}
            </View>
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}

// Address Account Card with full address and copy
function AddressAccountCard({
  account,
  disabled,
  onSignMessage,
  onSignTransaction,
  onExport,
}: {
  account: BitcoinAccount;
  disabled?: boolean;
  onSignMessage?: () => void;
  onSignTransaction?: () => void;
  onExport?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [account.address]);

  return (
    <ThemedView style={styles.accountCard}>
      {/* Header */}
      <View style={styles.accountHeader}>
        <View style={styles.accountTypeContainer}>
          <ThemedText style={styles.accountType}>{account.addressType}</ThemedText>
          <View style={styles.signatureBadge}>
            <Text style={styles.signatureBadgeText}>{account.signatureType}</Text>
          </View>
        </View>
      </View>

      {/* Full Address with Copy */}
      <TouchableOpacity style={styles.addressBox} onPress={handleCopy}>
        <ThemedText style={styles.fullAddress} selectable>
          {account.address}
        </ThemedText>
        <View style={[styles.copyBadge, copied && styles.copyBadgeCopied]}>
          <Text style={styles.copyBadgeText}>
            {copied ? "Copied!" : "Tap to copy"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, disabled && styles.disabled]}
          disabled={disabled}
          onPress={onSignMessage}
        >
          <ThemedText style={styles.actionBtnText}>Sign 🔐</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, disabled && styles.disabled]}
          disabled={disabled}
          onPress={onSignTransaction}
        >
          <ThemedText style={styles.actionBtnText}>Sign Tx</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.exportBtn, disabled && styles.disabled]}
          disabled={disabled}
          onPress={onExport}
        >
          <ThemedText style={styles.exportBtnText}>Export 🔐</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f7931a",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  authOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    borderRadius: 12,
  },
  authText: {
    color: "#fff",
    marginTop: 12,
    fontWeight: "600",
  },
  walletInfo: {
    marginBottom: 20,
  },
  walletId: {
    fontFamily: "monospace",
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  networkBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f7931a",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  networkBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  accountCount: {
    marginTop: 8,
    opacity: 0.7,
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  securityIcon: {
    fontSize: 18,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: "#10b981",
  },
  exportButton: {
    backgroundColor: "#ef4444",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  exportButtonIcon: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: "#f7931a",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  addButtonSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 4,
  },
  accountsList: {
    gap: 16,
    marginTop: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  // Account Card Styles
  accountCard: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountType: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f7931a",
  },
  signatureBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  signatureBadgeText: {
    color: "#3b82f6",
    fontSize: 11,
    fontWeight: "600",
  },
  addressBox: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 8,
    padding: 12,
  },
  fullAddress: {
    fontSize: 13,
    fontFamily: "monospace",
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  copyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f7931a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 10,
  },
  copyBadgeCopied: {
    backgroundColor: "#10b981",
  },
  copyBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  exportBtn: {
    backgroundColor: "#ef4444",
  },
  exportBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
