import { TREE_KEY_PREFIX } from './jsx-tree';
import type { MessageMeta } from './types';

export interface ChunkPathOptions {
  /**
   * Number of bits of the key hash used to pick a bucket. Determines bucket
   * count: 2^bits. Range 0–12.
   *
   * - `0` → 1 bucket (single flat file per locale)
   * - `4` → 16 buckets (default — sweet spot for 100–10k strings)
   * - `8` → 256 buckets (very large catalogs)
   * - `12` → 4096 buckets (enterprise-scale lazy-load surface)
   */
  readonly chunkBits?: number;
}

const DEFAULT_BITS = 4;
const MAX_BITS = 12;

/**
 * Bucket name for a key. Strips the `t.` tree prefix before reading the hash;
 * trees and plain strings hash into the same bucket space.
 */
export function bucketFor(key: string, chunkBits: number = DEFAULT_BITS): string {
  const bits = clampBits(chunkBits);
  if (bits === 0) return 'all';
  const hash = key.startsWith(TREE_KEY_PREFIX) ? key.slice(TREE_KEY_PREFIX.length) : key;
  const hexChars = Math.max(1, Math.ceil(bits / 4));
  return hash.slice(0, hexChars).toLowerCase();
}

function clampBits(bits: number): number {
  if (!Number.isFinite(bits) || bits <= 0) return 0;
  if (bits >= MAX_BITS) return MAX_BITS;
  return Math.floor(bits);
}

/**
 * Group keys into hash-bucket chunks. Same key → same bucket across every
 * locale, so adding a string only writes to one bucket file per locale.
 *
 * Returns `bucketName → keys`, alphabetized within each bucket for stable
 * diffs across runs.
 */
export function buildChunkLayout(
  manifest: Readonly<Record<string, MessageMeta | undefined>>,
  options: ChunkPathOptions = {},
): Map<string, ReadonlyArray<string>> {
  const bits = options.chunkBits ?? DEFAULT_BITS;
  const layout = new Map<string, string[]>();

  for (const key of Object.keys(manifest)) {
    const bucket = bucketFor(key, bits);
    let entries = layout.get(bucket);
    if (!entries) {
      entries = [];
      layout.set(bucket, entries);
    }
    entries.push(key);
  }

  const out = new Map<string, ReadonlyArray<string>>();
  for (const [bucket, keys] of layout) {
    keys.sort();
    out.set(bucket, keys);
  }
  return out;
}
