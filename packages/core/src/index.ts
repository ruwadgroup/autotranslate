/**
 * Framework-agnostic core for autotranslate.
 *
 * - Runtime translator (`createTranslator`)
 * - Canonical hashing (`hash`, `shortHash`)
 * - Structured message trees (`canonicalize`, `canonicalKey`,
 *   `renderTreeToString`)
 * - Shared catalog/manifest types
 *
 * Subpath entries: `./config`, `./locale`, `./icu`.
 */

export const VERSION = '0.0.0';

export { hash, shortHash } from './hash';

export {
  canonicalize,
  canonicalKey,
  isStructured,
  renderTreeToString,
  TREE_KEY_PREFIX,
} from './jsx-tree';
export type { Translator, TranslatorOptions } from './runtime';
export { applyContextToKey, CONTEXT_KEY_SEPARATOR, createTranslator } from './runtime';

export type {
  BranchNode,
  Catalog,
  CatalogEntry,
  Locale,
  Manifest,
  MessageMeta,
  MessageOccurrence,
  PluralNode,
  StructuredMessage,
  TagNode,
  TextNode,
  TranslationNode,
  VarNode,
} from './types';
