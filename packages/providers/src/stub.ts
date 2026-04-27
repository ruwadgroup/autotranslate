import type { CatalogEntry } from '@autotranslate/core';
import { pseudoLocalize, pseudoLocalizeTree } from './pseudo';
import type { Provider, TranslationItem } from './types';

export interface StubProviderOptions {
  /** Pseudo-localize every translation. Useful for surfacing untranslated copy. */
  readonly pseudo?: boolean;
}

/** Identity provider — returns the source unchanged, optionally pseudo-localized. */
export function createStubProvider(options: StubProviderOptions = {}): Provider {
  const { pseudo = false } = options;
  const signature = `stub${pseudo ? ':pseudo' : ''}`;

  return {
    name: 'stub',
    signature,
    async translate({ items }) {
      const translations: Record<string, CatalogEntry> = {};
      for (const item of items) {
        translations[item.key] = transform(item, pseudo);
      }
      return { translations };
    },
  };
}

function transform(item: TranslationItem, pseudo: boolean): CatalogEntry {
  if (typeof item.source === 'string') {
    return pseudo ? pseudoLocalize(item.source) : item.source;
  }
  return pseudo ? pseudoLocalizeTree(item.source) : item.source;
}
