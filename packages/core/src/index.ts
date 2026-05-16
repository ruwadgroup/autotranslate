export type { AutotranslateCatalog, CatalogKey } from './catalog-key';
export { hash, shortHash } from './hash';

export { canonicalKey, isStructured, renderTreeToString } from './jsx-tree';
export { sourceKey } from './key';
export { getMissBreakdown, getMissCount, resetMissStats } from './miss';
export type { Translator, TranslatorOptions } from './translator';
export { buildCatalog, createTranslator, WIRE_FORMAT_VERSION } from './translator';

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
