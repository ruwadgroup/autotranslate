import { AsyncLocalStorage } from 'node:async_hooks';
import type { CatalogKey } from './catalog-key';
import { createTranslator, type Translator, type TranslatorOptions } from './runtime';

const storage = new AsyncLocalStorage<Translator>();

/** Bind `translator` to the current async chain. Use `withTranslator` for scoped runs. */
export function bindTranslator(translator: Translator): void {
  storage.enterWith(translator);
}

/** Run `fn` with `translator` bound; restores the previous binding on exit. */
export function withTranslator<R>(translator: Translator, fn: () => R): R {
  return storage.run(translator, fn);
}

/** Read the active translator. Throws if none is bound. */
export function currentTranslator(caller?: string): Translator {
  const translator = storage.getStore();
  if (!translator) {
    throw new Error(
      `[autotranslate] No active translator${caller ? ` (called from ${caller})` : ''}. ` +
        `Wrap the call in \`withTranslator(t, fn)\` or call \`bindTranslator(t)\` at startup.`,
    );
  }
  return translator;
}

/**
 * Standalone translator for non-React code: zod errors, validators, async work.
 *
 * ```ts
 * import { t } from '@autotranslate/core/t';
 * t('Sign out');
 * ```
 */
export function t(key: CatalogKey, params?: Readonly<Record<string, unknown>>): string {
  return currentTranslator('t()').t(key, params);
}

export type { CatalogKey, Translator, TranslatorOptions };
export { createTranslator };
