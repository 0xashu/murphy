import { Tabs } from "expo-router";
import { Platform, Text } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerTintColor: "#f7931a",
        tabBarActiveTintColor: "#f7931a", // Bitcoin orange
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: "rgba(0,0,0,0.1)",
          paddingBottom: Platform.OS === "ios" ? 20 : 10,
          height: Platform.OS === "ios" ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Wallet",
          headerTitle: "Bitcoin Wallet",
          tabBarIcon: ({ color }) => <TabIcon name="wallet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transaction"
        options={{
          title: "Transaction",
          headerTitle: "Transactions",
          tabBarIcon: ({ color }) => <TabIcon name="transaction" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTitle: "Settings",
          tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}

// Simple text-based icons (can be replaced with proper icons)
function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    wallet: "₿",
    transaction: "↔",
    settings: "⚙",
  };

  return (
    <Text style={{ fontSize: 22, color }}>
      {icons[name] || "•"}
    </Text>
  );
}
