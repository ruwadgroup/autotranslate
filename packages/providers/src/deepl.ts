import type { CatalogEntry, Locale } from '@autotranslate/core';
import { defaultFetch, type FetchLike, safeReadText } from './fetch';
import { restorePlaceholders, shieldPlaceholders, UnsupportedICUError } from './placeholder-shield';
import type { Provider, TranslationItem, TranslationRequest } from './types';

export interface DeepLProviderOptions {
  readonly apiKey: string;
  /** Defaults to `https://api.deepl.com/v2/translate`; free tier uses `api-free`. */
  readonly endpoint?: string;
  /** Honored only by languages that support it (DE, FR, IT, …). */
  readonly formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less';
  readonly context?: string;
  readonly localeMap?: Readonly<Record<string, string>>;
  readonly fetch?: FetchLike;
}

const DEFAULT_ENDPOINT = 'https://api.deepl.com/v2/translate';
const MAX_TEXTS_PER_REQUEST = 50;

/**
 * DeepL translation provider. Plain-string entries only — placeholders are
 * shielded behind sentinels. Throws on plural / select / tag entries; route
 * those through the `ai` provider.
 */
export function createDeepLProvider(options: DeepLProviderOptions): Provider {
  const {
    apiKey,
    endpoint = DEFAULT_ENDPOINT,
    formality,
    context,
    localeMap,
    fetch: fetchImpl = defaultFetch(),
  } = options;
  if (!apiKey) {
    throw new Error('DeepL provider requires an `apiKey`.');
  }
  const signature = `deepl${formality ? `:${formality}` : ''}`;

  return {
    name: 'deepl',
    signature,
    async translate(request) {
      if (request.items.length === 0) return { translations: {} };
      assertStringEntriesOnly(request.items);

      const shielded = request.items.map((item) => ({
        item,
        ...shieldPlaceholders(item.source as string),
      }));

      const sourceLang = mapLocale(request.source, localeMap);
      const targetLang = mapLocale(request.target, localeMap);

      const translations: Record<string, CatalogEntry> = {};
      for (const batch of chunk(shielded, MAX_TEXTS_PER_REQUEST)) {
        const body: Record<string, unknown> = {
          text: batch.map((b) => b.text),
          target_lang: targetLang,
          source_lang: sourceLang,
        };
        if (formality) body.formality = formality;
        if (context) body.context = context;

        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'autotranslate-deepl/0.0.0',
          },
          body: JSON.stringify(body),
          ...(request.signal ? { signal: request.signal } : {}),
        });

        if (!response.ok) {
          const text = await safeReadText(response);
          throw new Error(
            `DeepL responded ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
          );
        }

        const json = (await response.json()) as DeepLResponse;
        if (!Array.isArray(json.translations)) {
          throw new Error('DeepL response did not include a translations array.');
        }
        if (json.translations.length !== batch.length) {
          throw new Error(
            `DeepL returned ${json.translations.length} translations for ${batch.length} inputs.`,
          );
        }
        for (let i = 0; i < batch.length; i++) {
          const entry = batch[i];
          const translated = json.translations[i];
          if (!entry || !translated) continue;
          translations[entry.item.key] = restorePlaceholders(translated.text, entry.slots);
        }
      }
      return { translations };
    },
  };
}

interface DeepLResponse {
  readonly translations?: ReadonlyArray<{ readonly text: string }>;
}

function assertStringEntriesOnly(items: ReadonlyArray<TranslationItem>): void {
  const structured = items.filter((i) => typeof i.source !== 'string');
  if (structured.length === 0) return;
  const sample = structured
    .slice(0, 3)
    .map((i) => i.key)
    .join(', ');
  throw new Error(
    `DeepL provider only handles plain-string entries; ` +
      `${structured.length} structured tree(s) (${sample}${structured.length > 3 ? ', …' : ''}) ` +
      `must use the \`ai\` provider.`,
  );
}

// DeepL accepts uppercase 2-letter (`DE`) plus a small set of regional codes.
function mapLocale(locale: Locale, override: Readonly<Record<string, string>> | undefined): string {
  if (override?.[locale]) return override[locale] as string;
  const upper = locale.toUpperCase();
  return REGIONAL_DEEPL_TARGETS.has(upper) ? upper : upper.split('-')[0]!;
}

const REGIONAL_DEEPL_TARGETS: ReadonlySet<string> = new Set([
  'EN-US',
  'EN-GB',
  'PT-BR',
  'PT-PT',
  'ZH-HANS',
  'ZH-HANT',
]);

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export type { TranslationRequest };
export { UnsupportedICUError };
