import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBitcoinWallet } from "@/hooks/use-bitcoin-wallet";
import { useBitcoinData, formatSatoshis, btcToSatoshis } from "@/hooks/use-bitcoin-data";
import { useBitcoinTransaction } from "@/hooks/use-bitcoin-transaction";
import { useSecureAction } from "@/hooks/use-secure-action";
import { isValidBitcoinAddress, isTestnetAddress } from "@/utils/bitcoin";
import { DUST_THRESHOLD } from "@/services/psbt-builder";
import type { Transaction, UTXO } from "@/services/mempool-api";

type FeeLevel = "fast" | "medium" | "slow" | "economy";

export default function TransactionScreen() {
  const { wallets, isReady } = useBitcoinWallet();
  const {
    addresses,
    totalBalance,
    fees,
    isLoading,
    fetchAllAddresses,
  } = useBitcoinData(); // Auto-detects network from address

  const {
    txState,
    sendBitcoin,
    estimateFee,
    resetTxState,
  } = useBitcoinTransaction(); // Auto-detects network from address

  const { sendTransaction: secureSendTransaction } = useSecureAction();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  // Send form state
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amountBtc, setAmountBtc] = useState("");
  const [feeLevel, setFeeLevel] = useState<FeeLevel>("medium");
  const [showSendForm, setShowSendForm] = useState(false);
  const [showAllAddresses, setShowAllAddresses] = useState(false);

  // Get all addresses from all wallets
  const allAddresses = useMemo(() => {
    return wallets.flatMap((w) => w.accounts.map((a) => a.address));
  }, [wallets]);

  // Detect network from first address
  const networkLabel = useMemo(() => {
    if (allAddresses.length === 0) return "Bitcoin";
    return isTestnetAddress(allAddresses[0]) ? "Signet" : "Mainnet";
  }, [allAddresses]);

  // Fetch data on mount and when addresses change
  useEffect(() => {
    if (isReady && allAddresses.length > 0) {
      fetchAllAddresses(allAddresses);
    }
  }, [isReady, allAddresses, fetchAllAddresses]);

  // Set initial selected address
  useEffect(() => {
    if (allAddresses.length > 0 && !selectedAddress) {
      setSelectedAddress(allAddresses[0]);
    }
  }, [allAddresses, selectedAddress]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllAddresses(allAddresses);
    setRefreshing(false);
  }, [fetchAllAddresses, allAddresses]);

  const hasWallets = wallets.length > 0;
  const hasAccounts = allAddresses.length > 0;
  const selectedData = selectedAddress ? addresses[selectedAddress] : null;

  // Get fee rate based on level
  const getFeeRate = useCallback(
    (level: FeeLevel): number => {
      if (!fees) return 1;
      switch (level) {
        case "fast":
          return fees.fastestFee;
        case "medium":
          return fees.halfHourFee;
        case "slow":
          return fees.hourFee;
        case "economy":
          return fees.economyFee;
      }
    },
    [fees]
  );

  // Calculate estimated fee
  const estimatedFee = useMemo(() => {
    if (!selectedAddress || !selectedData || !recipientAddress || !amountBtc) {
      return null;
    }

    const amount = btcToSatoshis(amountBtc);
    if (amount <= 0) return null;

    if (!isValidBitcoinAddress(recipientAddress)) return null;

    return estimateFee(
      selectedData.utxos,
      selectedAddress,
      recipientAddress,
      amount,
      getFeeRate(feeLevel)
    );
  }, [
    selectedAddress,
    selectedData,
    recipientAddress,
    amountBtc,
    feeLevel,
    getFeeRate,
    estimateFee,
  ]);

  // Handle send with biometric verification
  const handleSend = useCallback(async () => {
    if (!selectedAddress || !selectedData) {
      Alert.alert("Error", "Please select a sending address");
      return;
    }

    if (!isValidBitcoinAddress(recipientAddress)) {
      Alert.alert("Error", "Invalid recipient address");
      return;
    }

    const amount = btcToSatoshis(amountBtc);
    if (amount <= 0) {
      Alert.alert("Error", "Invalid amount");
      return;
    }

    // Check dust threshold
    if (amount < DUST_THRESHOLD) {
      Alert.alert(
        "Amount Too Small",
        `Minimum amount is ${DUST_THRESHOLD} satoshis (${(DUST_THRESHOLD / 100_000_000).toFixed(8)} BTC)`
      );
      return;
    }

    if (!estimatedFee) {
      Alert.alert("Error", "Insufficient funds");
      return;
    }

    // Use secure action with biometric verification
    const result = await secureSendTransaction(
      async () => {
        return await sendBitcoin({
          fromAddress: selectedAddress,
          toAddress: recipientAddress,
          amount,
          feeRate: getFeeRate(feeLevel),
          utxos: selectedData.utxos,
        });
      },
      formatSatoshis(amount),
      recipientAddress
    );

    if (result.success && result.result) {
      Alert.alert(
        "Transaction Sent!",
        `TxID: ${result.result.txid.slice(0, 20)}...\n\nFee: ${formatSatoshis(result.result.fee)}`,
        [
          {
            text: "OK",
            onPress: () => {
              setRecipientAddress("");
              setAmountBtc("");
              setShowSendForm(false);
              resetTxState();
              handleRefresh();
            },
          },
        ]
      );
    } else if (result.error && result.error !== "User cancelled") {
      Alert.alert("Transaction Failed", result.error, [
        {
          text: "OK",
          onPress: () => {
            // Reset state so user can try again
            resetTxState();
          },
        },
      ]);
    }
  }, [
    selectedAddress,
    selectedData,
    recipientAddress,
    amountBtc,
    estimatedFee,
    feeLevel,
    getFeeRate,
    sendBitcoin,
    secureSendTransaction,
    resetTxState,
    handleRefresh,
  ]);

  // Combine all transactions, sorted by time
  const allTransactions = useMemo(() => {
    const txs: (Transaction & { address: string })[] = [];
    Object.entries(addresses).forEach(([addr, data]) => {
      data.transactions.forEach((tx) => {
        txs.push({ ...tx, address: addr });
      });
    });
    return txs.sort((a, b) => {
      if (!a.status.confirmed) return -1;
      if (!b.status.confirmed) return 1;
      return (b.status.block_time || 0) - (a.status.block_time || 0);
    });
  }, [addresses]);

  // Get UTXOs for selected address
  const selectedUtxos = useMemo(() => {
    if (!selectedData) return [];
    return selectedData.utxos.sort((a, b) => b.value - a.value);
  }, [selectedData]);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <ThemedView style={styles.content}>
          {/* Status */}
          {!isReady && (
            <ThemedView style={styles.statusCard}>
              <ThemedText style={styles.statusText}>
                Initializing SDK...
              </ThemedText>
            </ThemedView>
          )}

          {isReady && !hasWallets && (
            <ThemedView style={styles.statusCard}>
              <ThemedText style={styles.statusText}>
                Create a wallet first to view transactions
              </ThemedText>
            </ThemedView>
          )}

          {/* Loading indicator */}
          {isLoading && !refreshing && (
            <ThemedView style={styles.loadingCard}>
              <ActivityIndicator color="#f7931a" />
              <ThemedText style={styles.loadingText}>
                Fetching blockchain data...
              </ThemedText>
            </ThemedView>
          )}

          {/* Transaction State */}
          {txState.step !== "idle" && txState.step !== "complete" && (
            <ThemedView style={styles.txStateCard}>
              <ActivityIndicator color="#f7931a" />
              <ThemedText style={styles.txStateText}>
                {txState.step === "building" && "Building transaction..."}
                {txState.step === "signing" && "Signing with Turnkey..."}
                {txState.step === "broadcasting" && "Broadcasting to network..."}
                {txState.step === "error" && `Error: ${txState.error}`}
              </ThemedText>
            </ThemedView>
          )}

          {hasAccounts && (
            <>
              {/* Total Balance Card */}
              <ThemedView style={styles.balanceCard}>
                <ThemedText style={styles.balanceLabel}>Total Balance</ThemedText>
                <ThemedText style={styles.balanceAmount}>
                  {formatSatoshis(totalBalance)}
                </ThemedText>
                <ThemedText style={styles.networkLabel}>{networkLabel}</ThemedText>
              </ThemedView>

              {/* Action Buttons */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={[styles.sendToggleButton, showSendForm && styles.cancelButton]}
                  onPress={() => {
                    setShowSendForm(!showSendForm);
                    if (!showSendForm) setShowAllAddresses(false);
                  }}
                >
                  <ThemedText style={styles.sendToggleText}>
                    {showSendForm ? "Cancel" : "Send Bitcoin"}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.addressesToggleButton, showAllAddresses && styles.addressesButtonActive]}
                  onPress={() => {
                    setShowAllAddresses(!showAllAddresses);
                    if (!showAllAddresses) setShowSendForm(false);
                  }}
                >
                  <ThemedText style={styles.addressesToggleText}>
                    {showAllAddresses ? "Hide Addresses" : "Show Addresses"}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {/* All Addresses Section */}
              {showAllAddresses && (
                <ThemedView style={styles.addressesSection}>
                  <ThemedText type="subtitle">Your Addresses</ThemedText>
                  <ThemedText style={styles.addressesSectionSubtitle}>
                    Tap any address to copy to clipboard
                  </ThemedText>
                  <View style={styles.addressesList}>
                    {wallets.flatMap((wallet) =>
                      wallet.accounts.map((account) => (
                        <CopyableAddressCard
                          key={account.address}
                          address={account.address}
                          addressType={account.addressType}
                          balance={addresses[account.address]?.balance}
                        />
                      ))
                    )}
                  </View>
                </ThemedView>
              )}

              {/* Send Form */}
              {showSendForm && (
                <ThemedView style={styles.sendForm}>
                  <ThemedText type="subtitle">Send Bitcoin</ThemedText>

                  {/* From Address Selector */}
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>From</ThemedText>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.addressScroll}
                    >
                      {allAddresses.map((addr) => {
                        const data = addresses[addr];
                        const isSelected = addr === selectedAddress;
                        return (
                          <TouchableOpacity
                            key={addr}
                            style={[
                              styles.addressChip,
                              isSelected && styles.addressChipSelected,
                            ]}
                            onPress={() => setSelectedAddress(addr)}
                          >
                            <ThemedText
                              style={[
                                styles.addressChipText,
                                isSelected && styles.addressChipTextSelected,
                              ]}
                            >
                              {addr.slice(0, 8)}...
                            </ThemedText>
                            {data && (
                              <ThemedText
                                style={[
                                  styles.addressChipBalance,
                                  isSelected && styles.addressChipTextSelected,
                                ]}
                              >
                                {formatSatoshis(data.balance, false)}
                              </ThemedText>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Recipient Address */}
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>To Address</ThemedText>

                    {/* Quick select from local wallets */}
                    {allAddresses.filter(addr => addr !== selectedAddress).length > 0 && (
                      <View style={styles.localAddressSection}>
                        <ThemedText style={styles.localAddressLabel}>
                          Select from your wallets:
                        </ThemedText>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.addressScroll}
                        >
                          {allAddresses
                            .filter(addr => addr !== selectedAddress)
                            .map((addr) => {
                              const data = addresses[addr];
                              const isSelected = addr === recipientAddress;
                              return (
                                <TouchableOpacity
                                  key={addr}
                                  style={[
                                    styles.toAddressChip,
                                    isSelected && styles.toAddressChipSelected,
                                  ]}
                                  onPress={() => setRecipientAddress(addr)}
                                >
                                  <ThemedText
                                    style={[
                                      styles.addressChipText,
                                      isSelected && styles.addressChipTextSelected,
                                    ]}
                                  >
                                    {addr.slice(0, 8)}...{addr.slice(-4)}
                                  </ThemedText>
                                  {data && (
                                    <ThemedText
                                      style={[
                                        styles.addressChipBalance,
                                        isSelected && styles.addressChipTextSelected,
                                      ]}
                                    >
                                      {formatSatoshis(data.balance, false)}
                                    </ThemedText>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                        </ScrollView>
                      </View>
                    )}

                    {/* Manual input for external addresses */}
                    <ThemedText style={styles.orLabel}>Or enter address:</ThemedText>
                    <TextInput
                      style={styles.textInput}
                      value={recipientAddress}
                      onChangeText={setRecipientAddress}
                      placeholder="tb1p... or bc1p..."
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {/* Amount */}
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Amount (BTC)</ThemedText>
                    <ThemedText style={styles.minAmountLabel}>
                      Min: {DUST_THRESHOLD} sats ({(DUST_THRESHOLD / 100_000_000).toFixed(8)} BTC)
                    </ThemedText>
                    <TextInput
                      style={styles.textInput}
                      value={amountBtc}
                      onChangeText={setAmountBtc}
                      placeholder="0.00001 (min 546 sats)"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />
                    {selectedData && (
                      <TouchableOpacity
                        style={styles.maxButton}
                        onPress={() => {
                          // Calculate max amount (balance - estimated fee)
                          const maxFee = getFeeRate(feeLevel) * 150; // Rough estimate
                          const max = Math.max(0, selectedData.balance - maxFee);
                          setAmountBtc((max / 100_000_000).toFixed(8));
                        }}
                      >
                        <ThemedText style={styles.maxButtonText}>MAX</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Fee Level */}
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Fee Level</ThemedText>
                    <View style={styles.feeButtons}>
                      {(["fast", "medium", "slow", "economy"] as FeeLevel[]).map(
                        (level) => (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.feeButton,
                              feeLevel === level && styles.feeButtonSelected,
                            ]}
                            onPress={() => setFeeLevel(level)}
                          >
                            <ThemedText
                              style={[
                                styles.feeButtonText,
                                feeLevel === level && styles.feeButtonTextSelected,
                              ]}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.feeButtonRate,
                                feeLevel === level && styles.feeButtonTextSelected,
                              ]}
                            >
                              {getFeeRate(level)} sat/vB
                            </ThemedText>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>

                  {/* Fee Estimate */}
                  {estimatedFee && (
                    <ThemedView style={styles.feeEstimate}>
                      <View style={styles.feeRow}>
                        <ThemedText style={styles.feeLabel}>Fee:</ThemedText>
                        <ThemedText style={styles.feeValue}>
                          {formatSatoshis(estimatedFee.fee)}
                        </ThemedText>
                      </View>
                      <View style={styles.feeRow}>
                        <ThemedText style={styles.feeLabel}>Change:</ThemedText>
                        <ThemedText style={styles.feeValue}>
                          {formatSatoshis(estimatedFee.change)}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  )}

                  {/* Insufficient funds warning */}
                  {amountBtc && !estimatedFee && selectedData && (
                    <ThemedView style={styles.warningCard}>
                      <ThemedText style={styles.warningText}>
                        Insufficient funds or invalid address
                      </ThemedText>
                    </ThemedView>
                  )}

                  {/* Send Button */}
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!estimatedFee || txState.step !== "idle") &&
                        styles.sendButtonDisabled,
                    ]}
                    disabled={!estimatedFee || txState.step !== "idle"}
                    onPress={handleSend}
                  >
                    <ThemedText style={styles.sendButtonText}>
                      {txState.step !== "idle" ? "Processing..." : "Send Bitcoin 🔐"}
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}

              {/* Fee Estimates */}
              {!showSendForm && fees && (
                <ThemedView style={styles.section}>
                  <ThemedText type="subtitle">Fee Estimates</ThemedText>
                  <View style={styles.feeGrid}>
                    <View style={styles.feeItem}>
                      <ThemedText style={styles.feeLabelSmall}>Fast</ThemedText>
                      <ThemedText style={styles.feeValueSmall}>
                        {fees.fastestFee} sat/vB
                      </ThemedText>
                    </View>
                    <View style={styles.feeItem}>
                      <ThemedText style={styles.feeLabelSmall}>30 min</ThemedText>
                      <ThemedText style={styles.feeValueSmall}>
                        {fees.halfHourFee} sat/vB
                      </ThemedText>
                    </View>
                    <View style={styles.feeItem}>
                      <ThemedText style={styles.feeLabelSmall}>1 hour</ThemedText>
                      <ThemedText style={styles.feeValueSmall}>
                        {fees.hourFee} sat/vB
                      </ThemedText>
                    </View>
                    <View style={styles.feeItem}>
                      <ThemedText style={styles.feeLabelSmall}>Economy</ThemedText>
                      <ThemedText style={styles.feeValueSmall}>
                        {fees.economyFee} sat/vB
                      </ThemedText>
                    </View>
                  </View>
                </ThemedView>
              )}

              {/* UTXOs for Selected Address */}
              {!showSendForm && selectedData && selectedUtxos.length > 0 && (
                <ThemedView style={styles.section}>
                  <ThemedText type="subtitle">
                    UTXOs ({selectedUtxos.length})
                  </ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>
                    Available for spending
                  </ThemedText>
                  <View style={styles.utxoList}>
                    {selectedUtxos.slice(0, 5).map((utxo) => (
                      <UtxoItem key={`${utxo.txid}-${utxo.vout}`} utxo={utxo} />
                    ))}
                    {selectedUtxos.length > 5 && (
                      <ThemedText style={styles.moreText}>
                        +{selectedUtxos.length - 5} more UTXOs
                      </ThemedText>
                    )}
                  </View>
                </ThemedView>
              )}

              {/* Transaction History */}
              {!showSendForm && (
                <ThemedView style={styles.section}>
                  <ThemedText type="subtitle">
                    Recent Transactions ({allTransactions.length})
                  </ThemedText>
                  {allTransactions.length === 0 ? (
                    <ThemedText style={styles.emptyText}>
                      No transactions yet
                    </ThemedText>
                  ) : (
                    <View style={styles.txList}>
                      {allTransactions.slice(0, 10).map((tx) => (
                        <TransactionItem key={tx.txid} tx={tx} />
                      ))}
                      {allTransactions.length > 10 && (
                        <ThemedText style={styles.moreText}>
                          +{allTransactions.length - 10} more transactions
                        </ThemedText>
                      )}
                    </View>
                  )}
                </ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Copyable Address Card Component
function CopyableAddressCard({
  address,
  addressType,
  balance,
}: {
  address: string;
  addressType: string;
  balance?: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <TouchableOpacity style={styles.copyableCard} onPress={handleCopy}>
      <View style={styles.copyableCardHeader}>
        <ThemedText style={styles.copyableCardType}>{addressType}</ThemedText>
        {balance !== undefined && (
          <ThemedText style={styles.copyableCardBalance}>
            {formatSatoshis(balance)}
          </ThemedText>
        )}
      </View>
      <ThemedText style={styles.copyableCardAddress} selectable>
        {address}
      </ThemedText>
      <View style={[styles.copyBadge, copied && styles.copyBadgeCopied]}>
        <Text style={styles.copyBadgeText}>
          {copied ? "Copied!" : "Tap to copy"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// UTXO Item Component
function UtxoItem({ utxo }: { utxo: UTXO }) {
  return (
    <View style={styles.utxoItem}>
      <View style={styles.utxoHeader}>
        <ThemedText style={styles.utxoTxid}>
          {utxo.txid.slice(0, 12)}...:{utxo.vout}
        </ThemedText>
        <View
          style={[
            styles.statusBadge,
            utxo.status.confirmed ? styles.confirmedBadge : styles.pendingBadge,
          ]}
        >
          <ThemedText style={styles.statusBadgeText}>
            {utxo.status.confirmed ? "Confirmed" : "Pending"}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={styles.utxoValue}>
        {formatSatoshis(utxo.value)}
      </ThemedText>
    </View>
  );
}

// Transaction Item Component
function TransactionItem({
  tx,
}: {
  tx: Transaction & { address: string };
}) {
  const router = useRouter();

  let amount = 0;
  tx.vout.forEach((out) => {
    if (out.scriptpubkey_address === tx.address) {
      amount += out.value;
    }
  });
  tx.vin.forEach((inp) => {
    if (inp.prevout?.scriptpubkey_address === tx.address) {
      amount -= inp.prevout.value;
    }
  });

  const txType = amount >= 0 ? "Received" : "Sent";
  const displayAmount = Math.abs(amount);

  const timeStr = tx.status.block_time
    ? new Date(tx.status.block_time * 1000).toLocaleDateString()
    : "Pending";

  const handlePress = useCallback(() => {
    router.push(`/transaction/${tx.txid}`);
  }, [router, tx.txid]);

  return (
    <TouchableOpacity
      style={styles.txItem}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.txHeader}>
        <View style={styles.txTypeContainer}>
          <ThemedText
            style={[
              styles.txType,
              amount >= 0 ? styles.txTypeReceived : styles.txTypeSent,
            ]}
          >
            {txType}
          </ThemedText>
          <ThemedText style={styles.txTime}>{timeStr}</ThemedText>
        </View>
        <ThemedText
          style={[
            styles.txAmount,
            amount >= 0 ? styles.txAmountReceived : styles.txAmountSent,
          ]}
        >
          {amount >= 0 ? "+" : "-"}
          {formatSatoshis(displayAmount)}
        </ThemedText>
      </View>
      <View style={styles.txDetails}>
        <ThemedText style={styles.txId}>{tx.txid.slice(0, 20)}...</ThemedText>
        <View
          style={[
            styles.statusBadge,
            tx.status.confirmed ? styles.confirmedBadge : styles.pendingBadge,
          ]}
        >
          <ThemedText style={styles.statusBadgeText}>
            {tx.status.confirmed
              ? `${tx.status.block_height?.toLocaleString()}`
              : "Unconfirmed"}
          </ThemedText>
        </View>
      </View>
      <View style={styles.txFooter}>
        {tx.fee > 0 && (
          <ThemedText style={styles.txFee}>
            Fee: {formatSatoshis(tx.fee)}
          </ThemedText>
        )}
        <ThemedText style={styles.viewDetails}>View details →</ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: "rgba(247, 147, 26, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusText: {
    textAlign: "center",
    opacity: 0.8,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247, 147, 26, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  loadingText: {
    opacity: 0.8,
  },
  txStateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  txStateText: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  balanceCard: {
    backgroundColor: "#f7931a",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  balanceAmount: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 8,
  },
  networkLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 8,
    textTransform: "uppercase",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  sendToggleButton: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#6b7280",
  },
  sendToggleText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  addressesToggleButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  addressesButtonActive: {
    backgroundColor: "#6b7280",
  },
  addressesToggleText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  addressesSection: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  addressesSectionSubtitle: {
    opacity: 0.6,
    fontSize: 12,
    marginTop: -8,
  },
  addressesList: {
    gap: 12,
  },
  copyableCard: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  copyableCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  copyableCardType: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f7931a",
  },
  copyableCardBalance: {
    fontSize: 14,
    fontWeight: "600",
  },
  copyableCardAddress: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  copyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f7931a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  copyBadgeCopied: {
    backgroundColor: "#10b981",
  },
  copyBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  sendForm: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.7,
  },
  minAmountLabel: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: -4,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  maxButton: {
    position: "absolute",
    right: 10,
    top: 32,
    backgroundColor: "#f7931a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  maxButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  addressScroll: {
    marginTop: 4,
  },
  addressChip: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    alignItems: "center",
  },
  addressChipSelected: {
    backgroundColor: "#f7931a",
  },
  addressChipText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  addressChipTextSelected: {
    color: "#fff",
  },
  addressChipBalance: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },
  localAddressSection: {
    marginBottom: 8,
  },
  localAddressLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  orLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
    marginTop: 4,
  },
  toAddressChip: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  toAddressChipSelected: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  feeButtons: {
    flexDirection: "row",
    gap: 8,
  },
  feeButton: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  feeButtonSelected: {
    backgroundColor: "#f7931a",
  },
  feeButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  feeButtonTextSelected: {
    color: "#fff",
  },
  feeButtonRate: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 2,
  },
  feeEstimate: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  feeLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  warningCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 10,
    padding: 12,
  },
  warningText: {
    color: "#ef4444",
    textAlign: "center",
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#f7931a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionSubtitle: {
    opacity: 0.6,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  feeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  feeItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  feeLabelSmall: {
    fontSize: 12,
    opacity: 0.6,
  },
  feeValueSmall: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  utxoList: {
    gap: 10,
  },
  utxoItem: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 12,
  },
  utxoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  utxoTxid: {
    fontSize: 12,
    fontFamily: "monospace",
    opacity: 0.7,
  },
  utxoValue: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  txList: {
    gap: 12,
    marginTop: 12,
  },
  txItem: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 14,
  },
  txHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  txTypeContainer: {
    gap: 2,
  },
  txType: {
    fontSize: 14,
    fontWeight: "600",
  },
  txTypeReceived: {
    color: "#10b981",
  },
  txTypeSent: {
    color: "#ef4444",
  },
  txTime: {
    fontSize: 11,
    opacity: 0.5,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  txAmountReceived: {
    color: "#10b981",
  },
  txAmountSent: {
    color: "#ef4444",
  },
  txDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  txId: {
    fontSize: 11,
    fontFamily: "monospace",
    opacity: 0.5,
  },
  txFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  txFee: {
    fontSize: 11,
    opacity: 0.5,
  },
  viewDetails: {
    fontSize: 12,
    color: "#f7931a",
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  confirmedBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  pendingBadge: {
    backgroundColor: "rgba(247, 147, 26, 0.15)",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  emptyText: {
    opacity: 0.5,
    textAlign: "center",
    marginTop: 20,
  },
  moreText: {
    opacity: 0.5,
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
});
