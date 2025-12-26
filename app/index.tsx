import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { EmailInput, validateEmail } from "@/components/auth/email-input";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import { OtpType } from "@/types/types";
import { DEFAULT_BITCOIN_WALLET_CONFIG } from "@/constants/bitcoin";

export default function LoginScreen() {
  const router = useRouter();
  const { initOtp, signUpWithPasskey, loginWithPasskey } = useTurnkey();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setEmailError(true);
      Alert.alert("Invalid Email", "Please enter a valid email address");
      return;
    }

    setLoading(true);

    const otpId = await initOtp({
      otpType: OtpType.Email,
      contact: email,
    });

    if (!otpId) {
      Alert.alert("Error", "Failed to initialize OTP");
      return;
    }

    setEmailError(false);
    setLoading(false);

    router.push({
      pathname: "/otp",
      params: { email, otpId },
    });
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) {
      setEmailError(false);
    }
  };

  const handleSignUpWithPasskeyPress = async () => {
    try {
      setLoading(true);
      console.log("signing up with passkey");
      await signUpWithPasskey({
        passkeyDisplayName: "BitcoinPasskey",
        createSubOrgParams: {
          customWallet: DEFAULT_BITCOIN_WALLET_CONFIG,
        },
      });
    } catch (error) {
      console.error("Error signing up with passkey", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithPasskeyPress = async () => {
    try {
      setLoading(true);
      await loginWithPasskey();
    } catch (error) {
      console.error("Error logging in with passkey", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo */}
            <Text style={[styles.logo, { color: colors.primaryText }]}>
              Turnkey
            </Text>

            {/* Title */}
            <Text style={[styles.title, { color: colors.primaryText }]}>
              Log in or sign up
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <EmailInput
                value={email}
                onChangeText={handleEmailChange}
                error={emailError}
                onSubmitEditing={handleEmailSubmit}
              />
            </View>

            {/* Passkey Button (Placeholder) */}
            <TouchableOpacity
              style={[
                styles.passkeyButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleLoginWithPasskeyPress}
              activeOpacity={0.8}
            >
              <Text style={styles.passkeyButtonText}>Login with passkey</Text>
            </TouchableOpacity>
            {/* Sign up with passkey Button */}
            <SecondaryButton
              onPress={handleSignUpWithPasskeyPress}
              disabled={!email}
              loading={loading}
            >
              Sign up with passkey
            </SecondaryButton>

            {/* Email Button */}
            <SecondaryButton
              onPress={handleEmailSubmit}
              disabled={!email}
              loading={loading}
            >
              Continue with email
            </SecondaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: "center",
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 32,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 16,
  },
  passkeyButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  passkeyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: "center",
  },
});
