export const VERSION = '0.0.0';

export { hash, shortHash } from './hash';

export {
  BRANCH_RESERVED_PROPS,
  canonicalize,
  canonicalKey,
  FORMAT_MARKER_PREFIX,
  isStructured,
  MARKER_NAMES,
  mergeAdjacentText,
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
