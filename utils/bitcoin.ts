import type { BitcoinAddressType } from "@/constants/bitcoin";

/**
 * Check if address is a valid Taproot address
 */
export function isTaprootAddress(address: string): boolean {
  return address.startsWith("bc1p") || address.startsWith("tb1p");
}

/**
 * Detect Bitcoin address type from address prefix
 * Only supports Taproot (P2TR)
 */
export function getBitcoinAddressType(address: string): BitcoinAddressType {
  if (!address) return "Unknown";

  if (isTaprootAddress(address)) {
    return "Taproot (P2TR)";
  }

  return "Unknown";
}

/**
 * Check if address is on testnet
 */
export function isTestnetAddress(address: string): boolean {
  return address.startsWith("tb1p");
}

/**
 * Format address for display (truncated)
 */
export function formatBitcoinAddress(
  address: string,
  startChars = 12,
  endChars = 10
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Validate Bitcoin address format (Taproot only)
 */
export function isValidBitcoinAddress(address: string): boolean {
  if (!address) return false;

  // Taproot addresses (bc1p/tb1p) are always 62 characters
  if (isTaprootAddress(address)) {
    return address.length === 62;
  }

  return false;
}

/**
 * Get signature type for address (always Schnorr for Taproot)
 */
export function getSignatureType(address: string): "Schnorr" | "Unknown" {
  if (isTaprootAddress(address)) {
    return "Schnorr";
  }
  return "Unknown";
}

/**
 * Convert satoshis to BTC
 */
export function satoshisToBtc(satoshis: number): number {
  return satoshis / 100_000_000;
}

/**
 * Convert BTC to satoshis
 */
export function btcToSatoshis(btc: number): number {
  return Math.round(btc * 100_000_000);
}

/**
 * Format BTC amount for display
 */
export function formatBtcAmount(satoshis: number, decimals = 8): string {
  const btc = satoshisToBtc(satoshis);
  return `${btc.toFixed(decimals)} BTC`;
}
