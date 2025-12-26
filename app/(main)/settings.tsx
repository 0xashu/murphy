import { StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTurnkey, ClientState } from "@turnkey/react-native-wallet-kit";
import { useBitcoinWallet } from "@/hooks/use-bitcoin-wallet";

export default function SettingsScreen() {
  const { logout, session, user, clientState } = useTurnkey();
  const { wallets } = useBitcoinWallet();

  const handleLogout = useCallback(async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }, [logout]);

  const getExpiryDate = () => {
    if (session?.expiry) {
      return new Date(session.expiry * 1000).toLocaleString();
    }
    return "N/A";
  };

  const getStatusColor = () => {
    switch (clientState) {
      case ClientState.Ready:
        return "#22c55e";
      case ClientState.Loading:
        return "#eab308";
      case ClientState.Error:
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  // Count total accounts
  const totalAccounts = wallets.reduce((sum, w) => sum + w.accounts.length, 0);

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        {/* SDK Status */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">SDK Status</ThemedText>
          <ThemedView style={styles.statusRow}>
            <ThemedView
              style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
            />
            <ThemedText style={styles.statusText}>
              {clientState ?? "Unknown"}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Session Info */}
        {session && (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Session</ThemedText>
            <ThemedView style={styles.infoList}>
              <InfoRow label="Organization ID" value={session.organizationId} />
              <InfoRow label="User ID" value={session.userId} />
              <InfoRow label="Session Type" value={session.sessionType || "N/A"} />
              <InfoRow label="Expires" value={getExpiryDate()} />
            </ThemedView>
          </ThemedView>
        )}

        {/* User Info */}
        {user && (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">User</ThemedText>
            <ThemedView style={styles.infoList}>
              <InfoRow label="User ID" value={user.userId} />
              <InfoRow label="Username" value={user.userName || "N/A"} />
              <InfoRow
                label="Email"
                value={user.userEmail || "N/A"}
              />
            </ThemedView>
          </ThemedView>
        )}

        {/* Wallet Stats */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Wallet Stats</ThemedText>
          <ThemedView style={styles.statsRow}>
            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statValue}>{wallets.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Wallets</ThemedText>
            </ThemedView>
            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statValue}>{totalAccounts}</ThemedText>
              <ThemedText style={styles.statLabel}>Accounts</ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* App Info */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">About</ThemedText>
          <ThemedView style={styles.infoList}>
            <InfoRow label="App" value="Bitcoin Wallet" />
            <InfoRow label="SDK" value="@turnkey/react-native-wallet-kit" />
            <InfoRow label="Network" value="Bitcoin Mainnet" />
          </ThemedView>
        </ThemedView>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
        </TouchableOpacity>

        {/* Version */}
        <ThemedText style={styles.version}>v1.0.0</ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const displayValue = value || "N/A";
  const truncated =
    displayValue.length > 24
      ? `${displayValue.slice(0, 12)}...${displayValue.slice(-8)}`
      : displayValue;

  return (
    <ThemedView style={infoStyles.row}>
      <ThemedText style={infoStyles.label}>{label}</ThemedText>
      <ThemedText style={infoStyles.value}>{truncated}</ThemedText>
    </ThemedView>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
  },
  value: {
    fontSize: 14,
    fontFamily: "monospace",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoList: {
    gap: 0,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(247, 147, 26, 0.1)",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#f7931a",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  version: {
    textAlign: "center",
    opacity: 0.5,
    fontSize: 12,
    marginBottom: 40,
  },
});
