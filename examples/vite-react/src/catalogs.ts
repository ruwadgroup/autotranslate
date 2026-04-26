import { catalogs } from 'virtual:autotranslate';
import type { Catalog } from '@autotranslate/core';

export function useCatalog(locale: string): Catalog {
  return catalogs[locale] ?? {};
}
