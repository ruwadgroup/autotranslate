import type { StructuredMessage } from './jsx-tree';

/** BCP-47 locale tag (e.g. `en`, `en-US`, `pt-BR`, `zh-Hans-CN`). */
export type Locale = string;

/** ICU template string (`useT`) or structured `<T>` tree. */
export type CatalogEntry = string | StructuredMessage;

/** Canonical key → message in a single locale. */
export type Catalog = Record<string, CatalogEntry>;

export interface MessageMeta {
  readonly context?: string;
  readonly description?: string;
  readonly maxChars?: number;
  readonly occurrences?: ReadonlyArray<MessageOccurrence>;
  readonly overrides?: Readonly<Record<Locale, string>>;
}

export interface MessageOccurrence {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

/** Index of every extracted key + its sidecar metadata. */
export type Manifest = Record<string, MessageMeta>;

export type {
  BranchNode,
  PluralNode,
  StructuredMessage,
  TagNode,
  TextNode,
  TranslationNode,
  VarNode,
} from './jsx-tree';
