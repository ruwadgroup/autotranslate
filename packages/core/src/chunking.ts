import type { MessageMeta } from './types';

export interface ChunkPathOptions {
  /** Hard cap before alphabetical splitting. Default 300. */
  readonly maxStringsPerChunk?: number;
}

const FALLBACK_CHUNK = '_external/_unknown';
const DEFAULT_MAX = 300;

/**
 * Pick the chunk path for a message based on its alphabetically-first
 * occurrence's source file. Returns a relative path with no extension.
 */
export function chunkPathFor(meta: MessageMeta | undefined): string {
  const occurrences = meta?.occurrences;
  if (!occurrences || occurrences.length === 0) return FALLBACK_CHUNK;
  const files = occurrences
    .map((o) => o.file)
    .filter((f): f is string => typeof f === 'string' && f.length > 0);
  if (files.length === 0) return FALLBACK_CHUNK;
  files.sort();
  return chunkPathFromFile(files[0] ?? '');
}

function chunkPathFromFile(file: string): string {
  let path = file.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '');
  if (path.startsWith('/')) path = path.slice(1);

  const externalMatch = path.match(/(?:^|\/)node_modules\/@autotranslate\/([^/]+)/);
  if (externalMatch) return `_external/${externalMatch[1]}`;

  const lastSlash = path.lastIndexOf('/');
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash) : '';
  const base = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  if (!stem) return FALLBACK_CHUNK;
  return dir ? `${dir}/${stem}` : stem;
}

/**
 * Group keys into chunks by source-file. Splits any oversized chunk into
 * alphabetical parts. Returns chunkPath → keys, sorted within each chunk.
 */
export function buildChunkLayout(
  manifest: Readonly<Record<string, MessageMeta | undefined>>,
  options: ChunkPathOptions = {},
): Map<string, ReadonlyArray<string>> {
  const max = options.maxStringsPerChunk ?? DEFAULT_MAX;
  const initial = new Map<string, string[]>();

  for (const [key, meta] of Object.entries(manifest)) {
    const path = chunkPathFor(meta);
    let bucket = initial.get(path);
    if (!bucket) {
      bucket = [];
      initial.set(path, bucket);
    }
    bucket.push(key);
  }

  const out = new Map<string, ReadonlyArray<string>>();
  for (const [path, keys] of initial) {
    keys.sort();
    if (keys.length <= max) {
      out.set(path, keys);
      continue;
    }
    const parts = Math.ceil(keys.length / max);
    const partSize = Math.ceil(keys.length / parts);
    for (let i = 0; i < parts; i++) {
      out.set(`${path}.${i}`, keys.slice(i * partSize, (i + 1) * partSize));
    }
  }
  return out;
}
