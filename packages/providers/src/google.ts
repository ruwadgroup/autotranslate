import type { CatalogEntry, Locale } from '@autotranslate/core';
import { defaultFetch, type FetchLike, safeReadText } from './fetch';
import { restorePlaceholders, shieldPlaceholders, UnsupportedICUError } from './placeholder-shield';
import type { Provider, TranslationItem } from './types';

export interface GoogleProviderOptions {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly localeMap?: Readonly<Record<string, string>>;
  readonly fetch?: FetchLike;
}

const DEFAULT_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const MAX_TEXTS_PER_REQUEST = 128;

/**
 * Google Cloud Translation v2 provider. Same scope as the DeepL provider —
 * plain-string entries only, ICU placeholders shielded behind sentinels.
 */
export function createGoogleProvider(options: GoogleProviderOptions): Provider {
  const {
    apiKey,
    endpoint = DEFAULT_ENDPOINT,
    localeMap,
    fetch: fetchImpl = defaultFetch(),
  } = options;
  if (!apiKey) {
    throw new Error('Google provider requires an `apiKey`.');
  }

  return {
    name: 'google',
    signature: 'google:v2',
    async translate(request) {
      if (request.items.length === 0) return { translations: {} };
      assertStringEntriesOnly(request.items);

      const shielded = request.items.map((item) => ({
        item,
        ...shieldPlaceholders(item.source as string),
      }));

      const target = mapLocale(request.target, localeMap);
      const source = mapLocale(request.source, localeMap);

      const translations: Record<string, CatalogEntry> = {};
      for (const batch of chunk(shielded, MAX_TEXTS_PER_REQUEST)) {
        const body = {
          q: batch.map((b) => b.text),
          target,
          source,
          format: 'text' as const,
        };
        const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'autotranslate-google/0.0.0',
          },
          body: JSON.stringify(body),
          ...(request.signal ? { signal: request.signal } : {}),
        });

        if (!response.ok) {
          const text = await safeReadText(response);
          throw new Error(
            `Google Translate responded ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
          );
        }

        const json = (await response.json()) as GoogleResponse;
        const translated = json.data?.translations;
        if (!Array.isArray(translated)) {
          throw new Error('Google response did not include a data.translations array.');
        }
        if (translated.length !== batch.length) {
          throw new Error(
            `Google returned ${translated.length} translations for ${batch.length} inputs.`,
          );
        }
        for (let i = 0; i < batch.length; i++) {
          const entry = batch[i];
          const out = translated[i];
          if (!entry || !out) continue;
          translations[entry.item.key] = restorePlaceholders(out.translatedText, entry.slots);
        }
      }
      return { translations };
    },
  };
}

interface GoogleResponse {
  readonly data?: {
    readonly translations?: ReadonlyArray<{ readonly translatedText: string }>;
  };
}

function assertStringEntriesOnly(items: ReadonlyArray<TranslationItem>): void {
  const structured = items.filter((i) => typeof i.source !== 'string');
  if (structured.length === 0) return;
  const sample = structured
    .slice(0, 3)
    .map((i) => i.key)
    .join(', ');
  throw new Error(
    `Google provider only handles plain-string entries; ` +
      `${structured.length} structured tree(s) (${sample}${structured.length > 3 ? ', …' : ''}) ` +
      `must use the \`ai\` provider.`,
  );
}

function mapLocale(locale: Locale, override: Readonly<Record<string, string>> | undefined): string {
  if (override?.[locale]) return override[locale] as string;
  return locale;
}

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export { UnsupportedICUError };
