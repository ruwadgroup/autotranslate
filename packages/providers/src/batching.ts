import type { CatalogEntry } from '@autotranslate/core';
import type { TranslationItem, TranslationRequest } from './types';

/**
 * Models drop items from structured-output arrays as batches grow, and a
 * dropped item is a missing translation. 25 keeps batches large enough to be
 * cheap and small enough to come back complete.
 */
export const DEFAULT_BATCH_SIZE = 25;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 500;
/** Batches that come back incomplete are re-asked for the missing keys only. */
const MAX_REPAIR_PASSES = 2;

/** Translates one slice of items. Partial results are expected and handled. */
export type BatchTranslator = (
  items: ReadonlyArray<TranslationItem>,
  request: TranslationRequest,
) => Promise<Record<string, CatalogEntry>>;

export interface BatchOptions {
  readonly batchSize?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  /** Test seam for backoff sleeps. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Split a request into batches, run each through `translateBatch`, retry
 * transient failures with exponential backoff, and re-ask for any keys the
 * model omitted. Shared by every model-backed provider - the failure modes
 * (transport blips, short arrays) are identical whether the model is reached
 * over HTTP or through an agent CLI.
 */
export async function translateInBatches(
  request: TranslationRequest,
  translateBatch: BatchTranslator,
  options: BatchOptions = {},
): Promise<Record<string, CatalogEntry>> {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    sleep = defaultSleep,
  } = options;

  const out: Record<string, CatalogEntry> = {};
  for (const batch of chunk(request.items, batchSize)) {
    let pending = [...batch];
    for (let pass = 0; pass <= MAX_REPAIR_PASSES && pending.length > 0; pass++) {
      // Repair passes halve the slice: whatever size lost items is too big.
      const size = pass === 0 ? pending.length : Math.max(1, Math.ceil(pending.length / 2));
      for (const slice of chunk(pending, size)) {
        const partial = await withRetry(
          () => translateBatch(slice, request),
          maxRetries,
          retryDelayMs,
          sleep,
          request.signal,
        );
        Object.assign(out, partial);
      }
      pending = pending.filter((item) => out[item.key] === undefined);
    }
  }
  return out;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number,
  sleep: (ms: number) => Promise<void>,
  signal: AbortSignal | undefined,
): Promise<T> {
  const attempts = Math.max(1, maxRetries);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      lastError = error;
      if (attempt === attempts - 1) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
