import type { Locale } from '@autotranslate/core';

const seen = new Set<string>();
const STREAMING_ENDPOINT = '/__autotranslate/translate';

export interface DevOnMissingOptions {
  readonly endpoint?: string;
  readonly fetch?: typeof fetch;
}

/**
 * `onMissing` for `<TranslationProvider>` that POSTs the missed key to the
 * dev streaming endpoint. Pair with `@autotranslate/vite`'s `streaming: true`
 * or `@autotranslate/next/streaming`.
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
        seen.delete(dedupe);
      });
    }
    return key;
  };
}
