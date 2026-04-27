import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

/** SHA-256 hex digest, optionally truncated to `length` chars (1–64). */
export function hash(input: string, length = 64): string {
  if (length <= 0 || length > 64 || !Number.isInteger(length)) {
    throw new RangeError(`hash length must be an integer in [1, 64], got ${length}`);
  }
  const hex = bytesToHex(sha256(input));
  return length === 64 ? hex : hex.slice(0, length);
}

/** 12-char SHA-256 hex, used as the canonical key for `<T>` trees. */
export function shortHash(input: string): string {
  return hash(input, 12);
}
