import type { Locale } from '@autotranslate/core';

const seen = new Set<string>();
const STREAMING_ENDPOINT = '/__autotranslate/translate';

export interface DevOnMissingOptions {
  /** Override the streaming endpoint. Defaults to `/__autotranslate/translate`. */
  readonly endpoint?: string;
  /** Custom fetch (for tests). Defaults to the global. */
  readonly fetch?: typeof fetch;
}

/**
 * Build an `onMissing` callback for `<TranslationProvider>` that POSTs the
 * key to the dev server's streaming endpoint. Falls back to returning the
 * key (the runtime's default) so rendering stays uninterrupted while the
 * translation lands.
 *
 * ```tsx
 * import { TranslationProvider, createDevOnMissing } from '@autotranslate/react';
 *
 * <TranslationProvider
 *   locale={locale}
 *   catalog={catalog}
 *   onMissing={import.meta.env.DEV ? createDevOnMissing() : undefined}
 * >
 * ```
 *
 * Pair with `@autotranslate/vite`'s `streaming: true` plugin option. In
 * production, omit `onMissing` — the runtime falls back to source on miss.
 */
export function createDevOnMissing(
  options: DevOnMissingOptions = {},
): (key: string, locale: Locale) => string {
  const endpoint = options.endpoint ?? STREAMING_ENDPOINT;
  const f = options.fetch ?? globalThis.fetch;
  return (key, locale) => {
    const dedupe = `${locale}::${key}`;
    if (!seen.has(dedupe)) {
      seen.add(dedupe);
      void f(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, source: key }),
      }).catch(() => {
        // dev-only: failures are non-fatal — the next render falls through
        // to the standard miss path again.
        seen.delete(dedupe);
      });
    }
    return key;
  };
}
