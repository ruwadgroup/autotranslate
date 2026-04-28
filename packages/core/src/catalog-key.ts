/** Augmented by `autotranslate generate-types` with the literal catalog keys. */
// biome-ignore lint/suspicious/noEmptyInterface: open for module augmentation
export interface AutotranslateCatalog {}

/** Generated catalog keys when typegen has run, plain `string` otherwise. */
export type CatalogKey = keyof AutotranslateCatalog extends never
  ? string
  : keyof AutotranslateCatalog | (string & {});
