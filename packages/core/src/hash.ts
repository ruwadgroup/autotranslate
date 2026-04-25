import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * SHA-256 hex digest of `input`, optionally truncated to `length` characters.
 *
 * The implementation is pure JavaScript (`@noble/hashes`) so the function is
 * synchronous and behaves identically in Node, browsers, and edge runtimes.
 * String inputs are UTF-8 encoded by the hasher; no TextEncoder needed.
 */
export function hash(input: string, length = 64): string {
  if (length <= 0 || length > 64 || !Number.isInteger(length)) {
    throw new RangeError(`hash length must be an integer in [1, 64], got ${length}`);
  }
  const hex = bytesToHex(sha256(input));
  return length === 64 ? hex : hex.slice(0, length);
}

/**
 * 12-character SHA-256 hex used as the canonical key for `<T>` trees.
 *
 * 12 hex chars = 48 bits of entropy; collision probability stays below 1e-6
 * up to ~6,000 distinct keys (birthday bound), which is well above the size
 * of any realistic translation catalog.
 */
export function shortHash(input: string): string {
  return hash(input, 12);
}
