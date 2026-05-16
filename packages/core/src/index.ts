export const VERSION = '0.0.0';

export type { AutotranslateCatalog, CatalogKey } from './catalog-key';
export { hash, shortHash } from './hash';

export { canonicalKey, isStructured, renderTreeToString } from './jsx-tree';
export type { Translator, TranslatorOptions } from './runtime';
export {
  buildCatalog,
  createTranslator,
  getMissBreakdown,
  getMissCount,
  resetMissStats,
  sourceKey,
  WIRE_FORMAT_VERSION,
} from './runtime';

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
