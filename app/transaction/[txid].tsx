import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBitcoinWallet } from "@/hooks/use-bitcoin-wallet";
import { formatSatoshis } from "@/hooks/use-bitcoin-data";
import { isTestnetAddress } from "@/utils/bitcoin";
import { MempoolApi, type Transaction } from "@/services/mempool-api";

export default function TransactionDetailScreen() {
  const { txid } = useLocalSearchParams<{ txid: string }>();
  const router = useRouter();
  const { wallets } = useBitcoinWallet();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get all addresses from wallets
  const allAddresses = useMemo(() => {
    return wallets.flatMap((w) => w.accounts.map((a) => a.address));
  }, [wallets]);

  // Detect network from first address
  const isTestnet = useMemo(() => {
    if (allAddresses.length === 0) return false;
    return isTestnetAddress(allAddresses[0]);
  }, [allAddresses]);

  const networkLabel = isTestnet ? "Signet" : "Mainnet";

  // Create API instance based on network
  const api = useMemo(() => {
    return new MempoolApi(isTestnet ? "signet" : "mainnet");
  }, [isTestnet]);

  // Mempool.space URL
  const mempoolUrl = useMemo(() => {
    const baseUrl = isTestnet
      ? "https://mempool.space/signet"
      : "https://mempool.space";
    return `${baseUrl}/tx/${txid}`;
  }, [isTestnet, txid]);

  // Fetch transaction details
  useEffect(() => {
    async function fetchTransaction() {
      if (!txid) return;

      setIsLoading(true);
      setError(null);

      try {
        const tx = await api.getTransaction(txid);
        setTransaction(tx);
      } catch (err) {
        console.error("Error fetching transaction:", err);
        setError("Failed to load transaction details");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransaction();
  }, [txid, api]);

  // Calculate transaction amount relative to our addresses
  const { amount, txType } = useMemo(() => {
    if (!transaction) return { amount: 0, txType: "Unknown" };

    let total = 0;

    // Add outputs to our addresses
    transaction.vout.forEach((out) => {
      if (allAddresses.includes(out.scriptpubkey_address || "")) {
        total += out.value;
      }
    });

    // Subtract inputs from our addresses
    transaction.vin.forEach((inp) => {
      if (allAddresses.includes(inp.prevout?.scriptpubkey_address || "")) {
        total -= inp.prevout?.value || 0;
      }
    });

    return {
      amount: total,
      txType: total >= 0 ? "Received" : "Sent",
    };
  }, [transaction, allAddresses]);

  // Handle copy
  const handleCopyTxid = useCallback(async () => {
    if (txid) {
      await Clipboard.setStringAsync(txid);
    }
  }, [txid]);

  // Handle open in mempool.space
  const handleOpenMempool = useCallback(() => {
    Linking.openURL(mempoolUrl);
  }, [mempoolUrl]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: "Transaction" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f7931a" />
          <ThemedText style={styles.loadingText}>Loading transaction...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !transaction) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: "Transaction" }} />
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>{error || "Transaction not found"}</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const confirmations = transaction.status.confirmed
    ? transaction.status.block_height
      ? "Confirmed"
      : "Confirmed"
    : "Unconfirmed";

  const blockTime = transaction.status.block_time
    ? new Date(transaction.status.block_time * 1000).toLocaleString()
    : "Pending";

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: txType === "Received" ? "Received" : "Sent",
        }}
      />

      <ThemedView style={styles.content}>
        {/* Amount Card */}
        <ThemedView
          style={[
            styles.amountCard,
            txType === "Received" ? styles.receivedCard : styles.sentCard,
          ]}
        >
          <ThemedText style={styles.amountLabel}>{txType}</ThemedText>
          <ThemedText style={styles.amountValue}>
            {txType === "Received" ? "+" : "-"}
            {formatSatoshis(Math.abs(amount))}
          </ThemedText>
          <ThemedText style={styles.networkBadge}>{networkLabel}</ThemedText>
        </ThemedView>

        {/* Status */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Status</ThemedText>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                transaction.status.confirmed
                  ? styles.confirmedBadge
                  : styles.pendingBadge,
              ]}
            >
              <ThemedText style={styles.statusBadgeText}>
                {confirmations}
              </ThemedText>
            </View>
            {transaction.status.block_height && (
              <ThemedText style={styles.blockHeight}>
                Block #{transaction.status.block_height.toLocaleString()}
              </ThemedText>
            )}
          </View>
          <ThemedText style={styles.timestamp}>{blockTime}</ThemedText>
        </ThemedView>

        {/* Transaction ID */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Transaction ID</ThemedText>
          <TouchableOpacity style={styles.txidBox} onPress={handleCopyTxid}>
            <ThemedText style={styles.txidText} selectable>
              {txid}
            </ThemedText>
            <View style={styles.copyHint}>
              <ThemedText style={styles.copyHintText}>Tap to copy</ThemedText>
            </View>
          </TouchableOpacity>
        </ThemedView>

        {/* Fee */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Fee</ThemedText>
          <View style={styles.feeRow}>
            <ThemedText style={styles.feeValue}>
              {formatSatoshis(transaction.fee)}
            </ThemedText>
            <ThemedText style={styles.feeRate}>
              {(transaction.fee / (transaction.weight / 4)).toFixed(2)} sat/vB
            </ThemedText>
          </View>
        </ThemedView>

        {/* Size */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Size</ThemedText>
          <View style={styles.sizeRow}>
            <View style={styles.sizeItem}>
              <ThemedText style={styles.sizeLabel}>Virtual Size</ThemedText>
              <ThemedText style={styles.sizeValue}>
                {Math.ceil(transaction.weight / 4)} vB
              </ThemedText>
            </View>
            <View style={styles.sizeItem}>
              <ThemedText style={styles.sizeLabel}>Weight</ThemedText>
              <ThemedText style={styles.sizeValue}>
                {transaction.weight} WU
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Inputs */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">
            Inputs ({transaction.vin.length})
          </ThemedText>
          <View style={styles.ioList}>
            {transaction.vin.slice(0, 5).map((input, index) => {
              const isOurs = allAddresses.includes(
                input.prevout?.scriptpubkey_address || ""
              );
              return (
                <View
                  key={`${input.txid}-${input.vout}`}
                  style={[styles.ioItem, isOurs && styles.ioItemOurs]}
                >
                  <ThemedText style={styles.ioAddress} numberOfLines={1}>
                    {input.prevout?.scriptpubkey_address || "Unknown"}
                  </ThemedText>
                  <ThemedText style={styles.ioValue}>
                    {formatSatoshis(input.prevout?.value || 0)}
                  </ThemedText>
                  {isOurs && (
                    <View style={styles.oursBadge}>
                      <ThemedText style={styles.oursBadgeText}>Yours</ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
            {transaction.vin.length > 5 && (
              <ThemedText style={styles.moreText}>
                +{transaction.vin.length - 5} more inputs
              </ThemedText>
            )}
          </View>
        </ThemedView>

        {/* Outputs */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">
            Outputs ({transaction.vout.length})
          </ThemedText>
          <View style={styles.ioList}>
            {transaction.vout.slice(0, 5).map((output, index) => {
              const isOurs = allAddresses.includes(
                output.scriptpubkey_address || ""
              );
              return (
                <View
                  key={`${index}-${output.scriptpubkey_address}`}
                  style={[styles.ioItem, isOurs && styles.ioItemOurs]}
                >
                  <ThemedText style={styles.ioAddress} numberOfLines={1}>
                    {output.scriptpubkey_address || "OP_RETURN"}
                  </ThemedText>
                  <ThemedText style={styles.ioValue}>
                    {formatSatoshis(output.value)}
                  </ThemedText>
                  {isOurs && (
                    <View style={styles.oursBadge}>
                      <ThemedText style={styles.oursBadgeText}>Yours</ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
            {transaction.vout.length > 5 && (
              <ThemedText style={styles.moreText}>
                +{transaction.vout.length - 5} more outputs
              </ThemedText>
            )}
          </View>
        </ThemedView>

        {/* View on Mempool.space */}
        <TouchableOpacity style={styles.mempoolButton} onPress={handleOpenMempool}>
          <ThemedText style={styles.mempoolButtonText}>
            View on Mempool.space
          </ThemedText>
          <ThemedText style={styles.mempoolButtonIcon}>↗</ThemedText>
        </TouchableOpacity>

        {/* Raw Data Link */}
        <ThemedText style={styles.mempoolUrl}>{mempoolUrl}</ThemedText>
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
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#f7931a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  amountCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: "center",
  },
  receivedCard: {
    backgroundColor: "#10b981",
  },
  sentCard: {
    backgroundColor: "#ef4444",
  },
  amountLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  amountValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 8,
  },
  networkBadge: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 8,
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  confirmedBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  pendingBadge: {
    backgroundColor: "rgba(247, 147, 26, 0.15)",
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  blockHeight: {
    opacity: 0.7,
    fontSize: 14,
  },
  timestamp: {
    opacity: 0.5,
    fontSize: 13,
    marginTop: 8,
  },
  txidBox: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  txidText: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 20,
  },
  copyHint: {
    alignSelf: "flex-start",
    backgroundColor: "#f7931a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 10,
  },
  copyHintText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  feeRate: {
    fontSize: 14,
    opacity: 0.6,
  },
  sizeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  sizeItem: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  sizeLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  sizeValue: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  ioList: {
    marginTop: 8,
    gap: 8,
  },
  ioItem: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ioItemOurs: {
    backgroundColor: "rgba(247, 147, 26, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(247, 147, 26, 0.3)",
  },
  ioAddress: {
    flex: 1,
    fontSize: 12,
    fontFamily: "monospace",
  },
  ioValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  oursBadge: {
    backgroundColor: "#f7931a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  oursBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  moreText: {
    textAlign: "center",
    opacity: 0.5,
    fontSize: 13,
    marginTop: 4,
  },
  mempoolButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  mempoolButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  mempoolButtonIcon: {
    color: "#fff",
    fontSize: 18,
  },
  mempoolUrl: {
    textAlign: "center",
    fontSize: 11,
    opacity: 0.4,
    marginTop: 12,
    fontFamily: "monospace",
  },
});
