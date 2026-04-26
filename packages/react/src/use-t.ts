import { createTranslator } from '@autotranslate/core';
import { useCallback, useMemo } from 'react';
import { useTranslationContext } from './context';

/**
 * Open interface augmented by `autotranslate generate-types` to expose the
 * known catalog keys to TypeScript. When unaugmented, `keyof` is `never`
 * and the `CatalogKey` alias falls back to `string` so callers compile
 * normally. When augmented, it narrows to the actual key set while still
 * accepting arbitrary strings via the `(string & {})` escape hatch.
 *
 * Generated declaration files merge into this interface like:
 *
 * ```ts
 * declare module '@autotranslate/react' {
 *   interface AutotranslateCatalog {
 *     'Sign out': true;
 *     't.abc123': true;
 *   }
 * }
 * ```
 *
 * The interface starts empty by design — module augmentation requires an
 * `interface` (not a type alias), and downstream typegen merges keys in.
 */
// biome-ignore lint/suspicious/noEmptyInterface: open for module augmentation
export interface AutotranslateCatalog {}

/**
 * String alias that resolves to the union of generated catalog keys (when
 * `autotranslate generate-types` has been run) or to plain `string` otherwise.
 * The `(string & {})` arm preserves autocomplete when keys are known while
 * still accepting arbitrary strings.
 */
export type CatalogKey = keyof AutotranslateCatalog extends never
  ? string
  : keyof AutotranslateCatalog | (string & {});

/**
 * Hook returning a translator function bound to the active locale + catalog.
 *
 * ```tsx
 * const t = useT();
 * t('Sign out');                                  // string
 * t('Hello, {name}!', { name });                  // ICU vars
 * t('Submit', { $context: 'form button' });       // disambiguation hint
 * ```
 *
 * Use `<T>` for JSX-shaped messages with markup; `useT` is the right choice
 * for plain strings (button labels, attributes, aria, programmatic copy).
 *
 * Reserved option keys (consumed by the translator, not the ICU formatter):
 * `$context`, `$description`, `$maxChars`.
 */
export function useT(): (key: CatalogKey, params?: Readonly<Record<string, unknown>>) => string {
  const { locale, catalog, fallback } = useTranslationContext();
  const translator = useMemo(
    () => createTranslator({ locale, catalog, ...(fallback ? { fallback } : {}) }),
    [locale, catalog, fallback],
  );
  return useCallback((key: CatalogKey, params) => translator.t(key, params), [translator]);
}

/**
 * Dictionary-mode hook. Curries `useT` with a namespace prefix so callers
 * can lookup nested keys without repeating the prefix.
 *
 * ```ts
 * // dictionary.ts
 * export default { dashboard: { title: 'Dashboard' } };
 *
 * // component.tsx
 * const t = useTranslations('dashboard');
 * t('title'); // → "Dashboard"
 * ```
 *
 * `namespace` is concatenated to the key with a `.` separator. Pass an empty
 * string (or omit) to address keys at the dictionary root.
 */
export function useTranslations(
  namespace?: string,
): (key: CatalogKey, params?: Readonly<Record<string, unknown>>) => string {
  const t = useT();
  const prefix = namespace ? `${namespace}.` : '';
  return useCallback((key: CatalogKey, params) => t(`${prefix}${key}`, params), [t, prefix]);
}

/**
 * Hook returning the active locale. Re-renders when the provider changes it.
 */
export function useLocale(): string {
  return useTranslationContext().locale;
}
