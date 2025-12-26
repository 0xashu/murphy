/**
 * ECC Library wrapper for bitcoinjs-lib
 * Uses @noble/secp256k1 v3 API
 */

import {
  Point,
  getPublicKey,
  sign,
  verify,
  schnorr,
  Signature,
  utils,
  etc,
} from "@noble/secp256k1";
import { initEccLib } from "bitcoinjs-lib";

const CURVE_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
);

// Create a TinySecp256k1Interface compatible wrapper
const ecc = {
  isPoint: (p: Uint8Array): boolean => {
    try {
      Point.fromBytes(p);
      return true;
    } catch {
      return false;
    }
  },

  isXOnlyPoint: (p: Uint8Array): boolean => {
    if (p.length !== 32) return false;
    try {
      // Try to construct a point with 02 prefix (even y)
      const fullPoint = new Uint8Array(33);
      fullPoint[0] = 0x02;
      fullPoint.set(p, 1);
      Point.fromBytes(fullPoint);
      return true;
    } catch {
      try {
        // Try with 03 prefix (odd y)
        const fullPoint = new Uint8Array(33);
        fullPoint[0] = 0x03;
        fullPoint.set(p, 1);
        Point.fromBytes(fullPoint);
        return true;
      } catch {
        return false;
      }
    }
  },

  isPrivate: (d: Uint8Array): boolean => {
    return utils.isValidSecretKey(d);
  },

  pointFromScalar: (d: Uint8Array, compressed = true): Uint8Array | null => {
    try {
      return getPublicKey(d, compressed);
    } catch {
      return null;
    }
  },

  pointCompress: (p: Uint8Array, compressed = true): Uint8Array => {
    const point = Point.fromBytes(p);
    return point.toBytes(compressed);
  },

  pointMultiply: (
    p: Uint8Array,
    tweak: Uint8Array,
    compressed = true
  ): Uint8Array | null => {
    try {
      const point = Point.fromBytes(p);
      const tweakBigInt = etc.bytesToNumberBE(tweak);
      const result = point.multiply(tweakBigInt);
      return result.toBytes(compressed);
    } catch {
      return null;
    }
  },

  pointAdd: (
    pA: Uint8Array,
    pB: Uint8Array,
    compressed = true
  ): Uint8Array | null => {
    try {
      const pointA = Point.fromBytes(pA);
      const pointB = Point.fromBytes(pB);
      const result = pointA.add(pointB);
      return result.toBytes(compressed);
    } catch {
      return null;
    }
  },

  pointAddScalar: (
    p: Uint8Array,
    tweak: Uint8Array,
    compressed = true
  ): Uint8Array | null => {
    try {
      const point = Point.fromBytes(p);
      const tweakPoint = Point.fromBytes(getPublicKey(tweak, false));
      const result = point.add(tweakPoint);
      return result.toBytes(compressed);
    } catch {
      return null;
    }
  },

  privateAdd: (d: Uint8Array, tweak: Uint8Array): Uint8Array | null => {
    try {
      const dBigInt = etc.bytesToNumberBE(d);
      const tweakBigInt = etc.bytesToNumberBE(tweak);
      const result = etc.mod(dBigInt + tweakBigInt, CURVE_ORDER);
      if (result === BigInt(0)) return null;
      return etc.numberToBytesBE(result);
    } catch {
      return null;
    }
  },

  privateNegate: (d: Uint8Array): Uint8Array => {
    const dBigInt = etc.bytesToNumberBE(d);
    const result = etc.mod(CURVE_ORDER - dBigInt, CURVE_ORDER);
    return etc.numberToBytesBE(result);
  },

  sign: (h: Uint8Array, d: Uint8Array, e?: Uint8Array): Uint8Array => {
    return sign(h, d, { prehash: false, extraEntropy: e });
  },

  signSchnorr: (h: Uint8Array, d: Uint8Array, e?: Uint8Array): Uint8Array => {
    return schnorr.sign(h, d, e);
  },

  verify: (
    h: Uint8Array,
    Q: Uint8Array,
    signature: Uint8Array,
    strict?: boolean
  ): boolean => {
    try {
      return verify(signature, h, Q, { prehash: false, lowS: strict });
    } catch {
      return false;
    }
  },

  verifySchnorr: (
    h: Uint8Array,
    Q: Uint8Array,
    signature: Uint8Array
  ): boolean => {
    try {
      // Q should be 32 bytes (x-only pubkey) for Schnorr
      const pubkey = Q.length === 32 ? Q : Q.slice(1, 33);
      return schnorr.verify(signature, h, pubkey);
    } catch {
      return false;
    }
  },

  xOnlyPointAddTweak: (
    p: Uint8Array,
    tweak: Uint8Array
  ): { parity: 0 | 1; xOnlyPubkey: Uint8Array } | null => {
    try {
      // p is 32-byte x-only pubkey, need to convert to full point
      // Assume even parity (02 prefix)
      const fullPoint = new Uint8Array(33);
      fullPoint[0] = 0x02;
      fullPoint.set(p, 1);

      const point = Point.fromBytes(fullPoint);
      const tweakPoint = Point.fromBytes(getPublicKey(tweak, false));
      const result = point.add(tweakPoint);
      const resultBytes = result.toBytes(true);

      const parity = (resultBytes[0] === 0x03 ? 1 : 0) as 0 | 1;
      const xOnlyPubkey = resultBytes.slice(1);

      return { parity, xOnlyPubkey };
    } catch {
      return null;
    }
  },
};

// Initialize the ECC library
export function initEcc() {
  initEccLib(ecc);
}

// Auto-initialize on import
initEcc();

export { ecc };
