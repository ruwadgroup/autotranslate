import type { CatalogKey } from './catalog-key';
import { createTranslator, type Translator, type TranslatorOptions } from './runtime';

let slot: Translator | undefined;

export function bindTranslator(translator: Translator): void {
  slot = translator;
}

export function withTranslator<R>(translator: Translator, fn: () => R): R {
  const prev = slot;
  slot = translator;
  try {
    return fn();
  } finally {
    slot = prev;
  }
}

export function currentTranslator(caller?: string): Translator {
  if (!slot) {
    throw new Error(
      `[autotranslate] No active translator${caller ? ` (called from ${caller})` : ''}. ` +
        `Call \`bindTranslator(t)\` at startup.`,
    );
  }
  return slot;
}

export function t(key: CatalogKey, params?: Readonly<Record<string, unknown>>): string {
  return currentTranslator('t()').t(key, params);
}

export type { CatalogKey, Translator, TranslatorOptions };
export { createTranslator };
