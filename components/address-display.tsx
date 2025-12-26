import { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

interface AddressDisplayProps {
  address: string;
  label?: string;
  showFull?: boolean;
  balance?: number;
  formatBalance?: (balance: number) => string;
}

/**
 * Address display component with copy functionality
 */
export function AddressDisplay({
  address,
  label,
  showFull = false,
  balance,
  formatBalance,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const displayAddress = showFull
    ? address
    : `${address.slice(0, 12)}...${address.slice(-8)}`;

  return (
    <TouchableOpacity style={styles.container} onPress={handleCopy}>
      <View style={styles.content}>
        {label && <ThemedText style={styles.label}>{label}</ThemedText>}
        <ThemedText style={styles.address} numberOfLines={showFull ? 2 : 1}>
          {displayAddress}
        </ThemedText>
        {balance !== undefined && formatBalance && (
          <ThemedText style={styles.balance}>
            {formatBalance(balance)}
          </ThemedText>
        )}
      </View>
      <View style={[styles.copyButton, copied && styles.copyButtonCopied]}>
        <Text style={styles.copyText}>{copied ? "Copied!" : "Copy"}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface AddressCardProps {
  address: string;
  addressType: string;
  balance?: number;
  formatBalance?: (balance: number) => string;
  onPress?: () => void;
}

/**
 * Full address card with type label and copy functionality
 */
export function AddressCard({
  address,
  addressType,
  balance,
  formatBalance,
  onPress,
}: AddressCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <ThemedView style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.addressType}>{addressType}</ThemedText>
        {balance !== undefined && formatBalance && (
          <ThemedText style={styles.cardBalance}>
            {formatBalance(balance)}
          </ThemedText>
        )}
      </View>

      <TouchableOpacity style={styles.addressContainer} onPress={handleCopy}>
        <ThemedText style={styles.fullAddress} selectable>
          {address}
        </ThemedText>
        <View style={[styles.copyBadge, copied && styles.copyBadgeCopied]}>
          <Text style={styles.copyBadgeText}>
            {copied ? "Copied!" : "Tap to copy"}
          </Text>
        </View>
      </TouchableOpacity>

      {onPress && (
        <TouchableOpacity style={styles.actionButton} onPress={onPress}>
          <ThemedText style={styles.actionButtonText}>View Details</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

interface AddressListProps {
  addresses: Array<{
    address: string;
    addressType: string;
    balance?: number;
  }>;
  formatBalance?: (balance: number) => string;
  onAddressPress?: (address: string) => void;
}

/**
 * List of addresses with full display and copy functionality
 */
export function AddressList({
  addresses,
  formatBalance,
  onAddressPress,
}: AddressListProps) {
  return (
    <View style={styles.list}>
      {addresses.map((item) => (
        <AddressCard
          key={item.address}
          address={item.address}
          addressType={item.addressType}
          balance={item.balance}
          formatBalance={formatBalance}
          onPress={onAddressPress ? () => onAddressPress(item.address) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: "600",
  },
  address: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  balance: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: "#f7931a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonCopied: {
    backgroundColor: "#10b981",
  },
  copyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addressType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f7931a",
  },
  cardBalance: {
    fontSize: 14,
    fontWeight: "bold",
  },
  addressContainer: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 8,
    padding: 12,
  },
  fullAddress: {
    fontSize: 13,
    fontFamily: "monospace",
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  copyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f7931a",
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  actionButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  list: {
    gap: 12,
  },
});
