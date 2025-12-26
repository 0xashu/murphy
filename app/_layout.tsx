// Initialize ECC library for bitcoinjs-lib (must be first)
import "@/utils/ecc";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { TurnkeyProvider, AuthState, useTurnkey } from "@turnkey/react-native-wallet-kit";
import { TURNKEY_CONFIG, TURNKEY_CALLBACKS } from "@/constants/turnkey";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

function AuthGate() {
  const { authState } = useTurnkey();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const isLoggedIn = authState === AuthState.Authenticated;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(main)" />
        <Stack.Screen
          name="wallet"
          options={{
            headerShown: true,
            headerBackTitle: "Back",
            headerTintColor: "#f7931a",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTitleStyle: {
              fontWeight: "600",
            },
          }}
        />
        <Stack.Screen
          name="transaction"
          options={{
            headerShown: true,
            headerBackTitle: "Back",
            headerTintColor: "#f7931a",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTitleStyle: {
              fontWeight: "600",
            },
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="otp" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <TurnkeyProvider config={TURNKEY_CONFIG} callbacks={TURNKEY_CALLBACKS}>
        <AuthGate />
        <StatusBar style="auto" />
      </TurnkeyProvider>
    </ThemeProvider>
  );
}
