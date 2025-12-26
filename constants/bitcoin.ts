/**
 * Bitcoin address formats supported by Turnkey
 * Taproot (P2TR) only - mainnet and testnet
 */

// Address formats - Taproot only
export const BitcoinAddressFormat = {
  // Taproot (P2TR) - BIP86 - Schnorr signatures
  // Addresses start with "bc1p" (mainnet) or "tb1p" (testnet)
  MAINNET_P2TR: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR",
  TESTNET_P2TR: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR",
} as const;

// BIP derivation paths - Taproot only
export const BitcoinDerivationPath = {
  // BIP86 - Taproot (P2TR)
  TAPROOT_MAINNET: "m/86'/0'/0'/0/0",
  TAPROOT_TESTNET: "m/86'/1'/0'/0/0",
} as const;

// Transaction type for Turnkey API
export const TRANSACTION_TYPE_BITCOIN = "TRANSACTION_TYPE_BITCOIN";

// Default wallet configuration for signup - Taproot only
export const DEFAULT_BITCOIN_WALLET_CONFIG = {
  walletName: "Bitcoin Wallet",
  walletAccounts: [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: BitcoinDerivationPath.TAPROOT_MAINNET,
      addressFormat: BitcoinAddressFormat.MAINNET_P2TR,
    },
  ],
};

// Testnet wallet configuration - Taproot only
export const TESTNET_BITCOIN_WALLET_CONFIG = {
  walletName: "Bitcoin Testnet Wallet",
  walletAccounts: [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: BitcoinDerivationPath.TAPROOT_TESTNET,
      addressFormat: BitcoinAddressFormat.TESTNET_P2TR,
    },
  ],
};

export type BitcoinAddressType = "Taproot (P2TR)" | "Unknown";
