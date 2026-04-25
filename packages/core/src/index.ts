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
export { createTranslator } from './runtime';

export type {
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
