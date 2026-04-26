import type { StructuredMessage } from './jsx-tree';

/**
 * BCP-47 locale tag (e.g. `en`, `en-US`, `pt-BR`, `zh-Hans-CN`).
 * Validated via `standardizeLocale` from `@autotranslate/core/locale`.
 */
export type Locale = string;

/**
 * A single entry in a catalog. Strings are ICU MessageFormat templates used by
 * `useT(key)`. Arrays are structured `<T>...</T>` trees produced by the
 * extractor and rendered back to React nodes at runtime.
 */
export type CatalogEntry = string | StructuredMessage;

/**
 * Map of canonical key → message in a single locale.
 *
 * - `useT('Sign out')` keys are the literal source string.
 * - `<T>` keys are `t.{12-hex}` derived from the canonical tree hash.
 */
export type Catalog = Record<string, CatalogEntry>;

/**
 * Per-key sidecar metadata. Persisted in `.translations/.meta.json` and used
 * by the CLI for context hints, locale-specific overrides, and IDE hover.
 *
 * The source message itself lives in the source-locale catalog
 * (`.translations/{source}.json`); meta only carries data that doesn't
 * belong on the catalog payload.
 */
export interface MessageMeta {
  /** Translator-facing context (e.g. "navbar", "checkout button"). */
  readonly context?: string;
  /** End-user description for tooling and editors. */
  readonly description?: string;
  /** Hard cap on translation length (passed to AI providers as guidance). */
  readonly maxChars?: number;
  /** Source locations where the key was extracted from. */
  readonly occurrences?: ReadonlyArray<MessageOccurrence>;
  /** Locale-specific manual overrides applied after machine translation. */
  readonly overrides?: Readonly<Record<Locale, string>>;
}

export interface MessageOccurrence {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

/**
 * Index of every extracted key with its sidecar metadata.
 */
export type Manifest = Record<string, MessageMeta>;

// Re-export structured-tree types so consumers of the main entry don't need a
// deep import. Implementations live in `./jsx-tree`.
export type {
  BranchNode,
  PluralNode,
  StructuredMessage,
  TagNode,
  TextNode,
  TranslationNode,
  VarNode,
} from './jsx-tree';
