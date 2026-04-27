import type { CatalogEntry, Locale } from '@autotranslate/core';

export interface TranslationItem {
  readonly key: string;
  readonly source: CatalogEntry;
  readonly context?: string;
  readonly description?: string;
  /** Soft length budget. Passed through as guidance to AI providers. */
  readonly maxChars?: number;
}

export interface TranslationRequest {
  readonly source: Locale;
  readonly target: Locale;
  readonly items: ReadonlyArray<TranslationItem>;
  /** System instruction (tone, audience, brand voice). */
  readonly instruction?: string;
  readonly signal?: AbortSignal;
}

export interface TranslationResult {
  readonly translations: Readonly<Record<string, CatalogEntry>>;
}

export interface Provider {
  readonly name: string;
  /** Short signature included in cache keys; bump to invalidate stale entries. */
  readonly signature: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

/** Identity helper for authoring custom providers. */
export function defineProvider<P extends Provider>(provider: P): P {
  return provider;
}
