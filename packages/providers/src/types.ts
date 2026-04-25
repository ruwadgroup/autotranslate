import type { CatalogEntry, Locale } from '@autotranslate/core';

/**
 * A single translation task: one source-locale entry to be translated into
 * the target locale.
 */
export interface TranslationItem {
  /** Canonical message key (`'Sign out'` or `'t.<hash>'`). */
  readonly key: string;
  /** Source-locale entry: ICU string or structured tree. */
  readonly source: CatalogEntry;
  /** Translator-facing context (e.g. `'navbar'`). */
  readonly context?: string;
  /** End-user description for the translator. */
  readonly description?: string;
}

/**
 * A request handed to a `Provider.translate` call. Implementations may batch
 * `items` internally but must return a translation for every key requested.
 */
export interface TranslationRequest {
  readonly source: Locale;
  readonly target: Locale;
  readonly items: ReadonlyArray<TranslationItem>;
  /** Free-form system instruction (tone, audience, brand voice). */
  readonly instruction?: string;
  /** Abort signal honored by network-bound providers. */
  readonly signal?: AbortSignal;
}

/**
 * The shape every provider returns. `translations` is a map keyed by the
 * `TranslationItem.key`; missing entries surface to the CLI as failures.
 */
export interface TranslationResult {
  readonly translations: Readonly<Record<string, CatalogEntry>>;
}

/**
 * The contract every translation provider implements. Stateless from the
 * caller's perspective — concurrency, batching, and caching are the CLI's
 * responsibility, not the provider's.
 */
export interface Provider {
  /** Stable provider name (e.g. `'stub'`, `'ai'`). Used in cache keys. */
  readonly name: string;
  /** A short signature included in the cache key so changing the provider
   * (e.g. switching AI model) invalidates stale entries. */
  readonly signature: string;
  /** Translate one batch of items. Throws on failure; CLI handles retries. */
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

/**
 * Identity-typed helper for authoring custom providers in user code.
 * Mirrors `defineConfig` from `@autotranslate/core/config`.
 */
export function defineProvider<P extends Provider>(provider: P): P {
  return provider;
}
