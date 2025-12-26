import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

/**
 * Security levels for different operations
 */
export type SecurityLevel = "low" | "medium" | "high" | "critical";

/**
 * Authentication methods available
 */
export type AuthMethod = "biometric" | "passcode" | "none";

export interface SecureActionOptions {
  /** Prompt message shown to user */
  promptMessage: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Fallback to device passcode if biometric fails */
  fallbackToPasscode?: boolean;
  /** Security level determines strictness */
  securityLevel?: SecurityLevel;
  /** Custom confirmation message before auth */
  confirmationMessage?: string;
  /** Require user to type "CONFIRM" for critical actions */
  requireTextConfirmation?: boolean;
}

export interface SecureActionResult {
  success: boolean;
  error?: string;
  method?: AuthMethod;
}

/**
 * Hook for protecting sensitive operations with biometric/passcode verification
 *
 * Security Levels:
 * - low: No verification needed
 * - medium: Biometric only (e.g., sign message)
 * - high: Biometric + confirmation dialog (e.g., send transaction)
 * - critical: Biometric + confirmation dialog + warning (e.g., export mnemonic)
 */
export function useSecureAction() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check device capabilities on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setIsAvailable(compatible && enrolled);

      const methods: AuthMethod[] = [];
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        methods.push("biometric");
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        methods.push("biometric");
      }
      methods.push("passcode");
      setAuthMethods([...new Set(methods)]);
    } catch (error) {
      console.error("Error checking auth availability:", error);
      setIsAvailable(false);
    }
  };

  /**
   * Authenticate user with biometric/passcode
   */
  const authenticate = useCallback(
    async (options: SecureActionOptions): Promise<SecureActionResult> => {
      const {
        promptMessage,
        cancelLabel = "Cancel",
        fallbackToPasscode = true,
        securityLevel = "high",
      } = options;

      // Low security - no auth needed
      if (securityLevel === "low") {
        return { success: true, method: "none" };
      }

      // Check if device supports authentication
      if (!isAvailable) {
        // Allow action but warn user
        return new Promise((resolve) => {
          Alert.alert(
            "Security Warning",
            "Biometric authentication is not available on this device. Do you want to proceed anyway?",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve({ success: false, error: "Cancelled" }),
              },
              {
                text: "Proceed",
                style: "destructive",
                onPress: () => resolve({ success: true, method: "none" }),
              },
            ]
          );
        });
      }

      setIsAuthenticating(true);

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          cancelLabel,
          fallbackLabel: fallbackToPasscode ? "Use Passcode" : undefined,
          disableDeviceFallback: !fallbackToPasscode,
        });

        setIsAuthenticating(false);

        if (result.success) {
          return { success: true, method: "biometric" };
        } else {
          return {
            success: false,
            error: result.error || "Authentication failed",
          };
        }
      } catch (error) {
        setIsAuthenticating(false);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Authentication error",
        };
      }
    },
    [isAvailable]
  );

  /**
   * Execute a sensitive action with appropriate verification
   */
  const executeSecureAction = useCallback(
    async <T>(
      action: () => Promise<T>,
      options: SecureActionOptions
    ): Promise<{ success: boolean; result?: T; error?: string }> => {
      const { securityLevel = "high", confirmationMessage, requireTextConfirmation } = options;

      // Step 1: Show confirmation dialog for high/critical actions
      if (securityLevel === "high" || securityLevel === "critical") {
        const confirmed = await new Promise<boolean>((resolve) => {
          const message =
            confirmationMessage ||
            (securityLevel === "critical"
              ? "This is a sensitive operation. Your secret data will be exposed. Are you sure?"
              : "Do you want to proceed with this action?");

          Alert.alert(
            securityLevel === "critical" ? "Security Warning" : "Confirm Action",
            message,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Continue",
                style: securityLevel === "critical" ? "destructive" : "default",
                onPress: () => resolve(true),
              },
            ]
          );
        });

        if (!confirmed) {
          return { success: false, error: "User cancelled" };
        }
      }

      // Step 2: Biometric authentication
      const authResult = await authenticate(options);

      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Step 3: Execute the action
      try {
        const result = await action();
        return { success: true, result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Action failed",
        };
      }
    },
    [authenticate]
  );

  /**
   * Pre-configured secure actions for common operations
   */
  const secureActions = {
    /**
     * Export wallet mnemonic - Critical security
     */
    exportMnemonic: useCallback(
      <T>(action: () => Promise<T>) =>
        executeSecureAction(action, {
          promptMessage: "Authenticate to export mnemonic",
          securityLevel: "critical",
          confirmationMessage:
            "You are about to reveal your wallet's recovery phrase.\n\n" +
            "Anyone with this phrase can access ALL your funds.\n\n" +
            "Never share it with anyone!",
        }),
      [executeSecureAction]
    ),

    /**
     * Export private key - Critical security
     */
    exportPrivateKey: useCallback(
      <T>(action: () => Promise<T>) =>
        executeSecureAction(action, {
          promptMessage: "Authenticate to export private key",
          securityLevel: "critical",
          confirmationMessage:
            "You are about to reveal this account's private key.\n\n" +
            "Anyone with this key can control this account.\n\n" +
            "Never share it with anyone!",
        }),
      [executeSecureAction]
    ),

    /**
     * Send transaction - High security
     */
    sendTransaction: useCallback(
      <T>(action: () => Promise<T>, amount?: string, recipient?: string) =>
        executeSecureAction(action, {
          promptMessage: "Authenticate to send Bitcoin",
          securityLevel: "high",
          confirmationMessage: amount && recipient
            ? `Send ${amount} to ${recipient.slice(0, 12)}...?`
            : "Confirm this transaction?",
        }),
      [executeSecureAction]
    ),

    /**
     * Sign message - Medium security
     */
    signMessage: useCallback(
      <T>(action: () => Promise<T>) =>
        executeSecureAction(action, {
          promptMessage: "Authenticate to sign message",
          securityLevel: "medium",
        }),
      [executeSecureAction]
    ),

    /**
     * Create account - Low security (session already authenticated)
     */
    createAccount: useCallback(
      <T>(action: () => Promise<T>) =>
        executeSecureAction(action, {
          promptMessage: "Authenticate to create account",
          securityLevel: "low",
        }),
      [executeSecureAction]
    ),
  };

  return {
    // State
    isAvailable,
    authMethods,
    isAuthenticating,

    // Methods
    authenticate,
    executeSecureAction,

    // Pre-configured actions
    ...secureActions,
  };
}

/**
 * Security level recommendations:
 *
 * | Operation           | Level    | Biometric | Confirm | Warning |
 * |---------------------|----------|-----------|---------|---------|
 * | Create wallet       | low      | No        | No      | No      |
 * | Create account      | low      | No        | No      | No      |
 * | View balance        | low      | No        | No      | No      |
 * | Sign message        | medium   | Yes       | No      | No      |
 * | Send transaction    | high     | Yes       | Yes     | No      |
 * | Export private key  | critical | Yes       | Yes     | Yes     |
 * | Export mnemonic     | critical | Yes       | Yes     | Yes     |
 * | Delete wallet       | critical | Yes       | Yes     | Yes     |
 */
