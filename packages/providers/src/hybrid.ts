import type { CatalogEntry } from '@autotranslate/core';
import { isStructured } from '@autotranslate/core';
import type { Provider, TranslationResult } from './types';

export interface HybridProviderOptions {
  /** Provider for structured-tree entries (`<T>` blocks, plurals, branches). */
  readonly ai: Provider;
  /** Provider for plain-string entries (`useT` literals, dictionary strings). */
  readonly plain: Provider;
}

/** Routes structured-tree entries to `ai` and plain strings to `plain` (DeepL or Google). */
export function createHybridProvider(options: HybridProviderOptions): Provider {
  const { ai, plain } = options;
  return {
    name: 'hybrid',
    signature: `hybrid:${ai.signature}+${plain.signature}`,
    async translate(request) {
      if (request.items.length === 0) return { translations: {} };

      const structured = request.items.filter((i) => isStructured(i.source));
      const plainItems = request.items.filter((i) => !isStructured(i.source));

      const calls: Array<Promise<TranslationResult>> = [];
      if (structured.length > 0) calls.push(ai.translate({ ...request, items: structured }));
      if (plainItems.length > 0) calls.push(plain.translate({ ...request, items: plainItems }));

      const results = await Promise.all(calls);
      const translations: Record<string, CatalogEntry> = {};
      for (const r of results) Object.assign(translations, r.translations);
      return { translations };
    },
  } satisfies Provider;
}
