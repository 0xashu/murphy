import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  View,
} from "react-native";
import { useCallback } from "react";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBitcoinWallet } from "@/hooks/use-bitcoin-wallet";
import { isTestnetAddress } from "@/utils/bitcoin";

export default function WalletListScreen() {
  const router = useRouter();
  const { wallets, isReady, createWallet } = useBitcoinWallet();

  const handleCreateWallet = useCallback(
    async (isTestnet: boolean) => {
      try {
        const networkName = isTestnet ? "Signet" : "Mainnet";
        const walletId = await createWallet({
          walletName: `${networkName} Wallet ${wallets.length + 1}`,
          isTestnet,
        });
        // Navigate to the new wallet
        router.push(`/wallet/${walletId}`);
      } catch (error) {
        console.error("Error creating wallet:", error);
        Alert.alert("Error", "Failed to create wallet");
      }
    },
    [createWallet, wallets.length, router]
  );

  const handleWalletPress = useCallback(
    (walletId: string) => {
      router.push(`/wallet/${walletId}`);
    },
    [router]
  );

  // Get network label for a wallet
  const getNetworkLabel = (address: string) => {
    return isTestnetAddress(address) ? "Signet" : "Mainnet";
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        {/* Subtitle */}
        <ThemedText style={styles.subtitle}>Taproot (P2TR) - Powered by Turnkey</ThemedText>

        {/* Create Wallet Buttons */}
        <View style={styles.createButtonsRow}>
          <TouchableOpacity
            style={[styles.createButton, styles.mainnetButton, !isReady && styles.disabled]}
            disabled={!isReady}
            onPress={() => handleCreateWallet(false)}
          >
            <ThemedText style={styles.createButtonText}>+ Mainnet</ThemedText>
            <ThemedText style={styles.createButtonSubtext}>bc1p...</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, styles.testnetButton, !isReady && styles.disabled]}
            disabled={!isReady}
            onPress={() => handleCreateWallet(true)}
          >
            <ThemedText style={styles.createButtonText}>+ Signet</ThemedText>
            <ThemedText style={styles.createButtonSubtext}>tb1p...</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Wallets List */}
        {wallets.length > 0 && (
          <ThemedView style={styles.walletsList}>
            <ThemedText type="subtitle" style={styles.listTitle}>
              Your Wallets
            </ThemedText>
            {wallets.map((wallet) => {
              const networkLabel = wallet.accounts[0]
                ? getNetworkLabel(wallet.accounts[0].address)
                : "Unknown";

              return (
                <TouchableOpacity
                  key={wallet.walletId}
                  style={styles.walletCard}
                  onPress={() => handleWalletPress(wallet.walletId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.walletCardContent}>
                    <View style={styles.walletIcon}>
                      <ThemedText style={styles.walletIconText}>₿</ThemedText>
                    </View>
                    <View style={styles.walletInfo}>
                      <ThemedText type="defaultSemiBold">
                        {wallet.walletName}
                      </ThemedText>
                      <ThemedText style={styles.walletMeta}>
                        {wallet.accounts.length} account
                        {wallet.accounts.length !== 1 ? "s" : ""}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.chevron}>›</ThemedText>
                  </View>

                  {/* Network Badge */}
                  <View style={styles.networkRow}>
                    <View
                      style={[
                        styles.networkBadge,
                        networkLabel === "Signet" && styles.testnetBadge,
                      ]}
                    >
                      <ThemedText style={styles.networkBadgeText}>
                        {networkLabel} - Taproot
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    opacity: 0.6,
    marginBottom: 16,
  },
  createButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  createButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  mainnetButton: {
    backgroundColor: "#f7931a",
  },
  testnetButton: {
    backgroundColor: "#6366f1",
  },
  createButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  createButtonSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  walletsList: {
    gap: 12,
  },
  listTitle: {
    marginBottom: 8,
  },
  walletCard: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 16,
  },
  walletCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f7931a",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  walletIconText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  walletInfo: {
    flex: 1,
  },
  walletMeta: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    opacity: 0.4,
    marginLeft: 8,
  },
  networkRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  networkBadge: {
    backgroundColor: "#f7931a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  testnetBadge: {
    backgroundColor: "#6366f1",
  },
  networkBadgeText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
  },
});
