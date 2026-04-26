import type { CatalogEntry } from '@autotranslate/core';
import { pseudoLocalize, pseudoLocalizeTree } from './pseudo';
import type { Provider, TranslationItem } from './types';

export interface StubProviderOptions {
  /**
   * Pseudo-localize every translation. Letters are accented, content is
   * wrapped in expansion brackets, and ICU tokens / vars are preserved.
   * Useful for surfacing untranslated strings and layout overflow during dev.
   */
  readonly pseudo?: boolean;
}

/**
 * Identity translation provider.
 *
 * Returns the source as the translation, optionally pseudo-localized. Use it
 * for tests, end-to-end smoke runs, and as a development default before AI
 * credentials are configured.
 */
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
