import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatBitcoinAddress } from "@/utils/bitcoin";
import type { BitcoinAccount } from "@/hooks/use-bitcoin-wallet";

interface AccountCardProps {
  account: BitcoinAccount;
  disabled?: boolean;
  onSignMessage?: () => void;
  onSignTransaction?: () => void;
  onExport?: () => void;
}

export function AccountCard({
  account,
  disabled = false,
  onSignMessage,
  onSignTransaction,
  onExport,
}: AccountCardProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.addressType}>{account.addressType}</ThemedText>
      <ThemedText style={styles.signatureType}>
        {account.signatureType} Signature
      </ThemedText>
      <ThemedText style={styles.address}>
        {formatBitcoinAddress(account.address)}
      </ThemedText>

      <View style={styles.buttonRow}>
        {onSignMessage && (
          <TouchableOpacity
            style={[styles.button, styles.signMsgButton, disabled && styles.disabled]}
            disabled={disabled}
            onPress={onSignMessage}
          >
            <ThemedText style={styles.buttonText}>Sign Msg</ThemedText>
          </TouchableOpacity>
        )}

        {onSignTransaction && (
          <TouchableOpacity
            style={[styles.button, styles.signTxButton, disabled && styles.disabled]}
            disabled={disabled}
            onPress={onSignTransaction}
          >
            <ThemedText style={styles.buttonText}>Sign TX</ThemedText>
          </TouchableOpacity>
        )}

        {onExport && (
          <TouchableOpacity
            style={[styles.button, styles.exportButton, disabled && styles.disabled]}
            disabled={disabled}
            onPress={onExport}
          >
            <ThemedText style={styles.buttonText}>Export</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  addressType: {
    fontSize: 11,
    fontWeight: "600",
    color: "#f7931a",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  signatureType: {
    fontSize: 10,
    color: "#666",
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    fontFamily: "monospace",
    marginBottom: 10,
    color: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  signMsgButton: {
    backgroundColor: "#3b82f6",
  },
  signTxButton: {
    backgroundColor: "#f7931a",
  },
  exportButton: {
    backgroundColor: "#10b981",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  disabled: {
    opacity: 0.6,
  },
});
