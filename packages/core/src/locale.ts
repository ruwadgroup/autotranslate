import type { Locale } from './types';

export type { PluralCategory } from './plural';
export { getPluralCategory, isPluralCategory, PLURAL_CATEGORIES } from './plural';

export type LocaleDirection = 'ltr' | 'rtl';

const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'ha',
  'he',
  'khw',
  'ks',
  'ps',
  'sd',
  'ur',
  'yi',
]);

const ALIASES: Readonly<Record<string, string>> = {
  iw: 'he',
  in: 'id',
  ji: 'yi',
  jw: 'jv',
  mo: 'ro',
  sh: 'sr-Latn',
  tl: 'fil',
};

export function isValidLocale(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.Locale(value);
    return true;
  } catch {
    return false;
  }
}

/** Normalize a locale tag to canonical BCP-47. Throws if structurally invalid. */
export function standardizeLocale(value: string): Locale {
  const aliased = applyAlias(value);
  return new Intl.Locale(aliased).toString();
}

function applyAlias(value: string): string {
  const dash = value.indexOf('-');
  const lang = (dash === -1 ? value : value.slice(0, dash)).toLowerCase();
  const aliased = ALIASES[lang];
  if (!aliased) return value;
  return dash === -1 ? aliased : aliased + value.slice(dash);
}

export function getDirection(locale: Locale): LocaleDirection {
  let parsed: Intl.Locale;
  try {
    parsed = new Intl.Locale(locale);
  } catch {
    return 'ltr';
  }
  const info = (parsed as { textInfo?: { direction: LocaleDirection } }).textInfo;
  if (info?.direction === 'ltr' || info?.direction === 'rtl') {
    return info.direction;
  }
  return RTL_LANGUAGES.has(parsed.language ?? '') ? 'rtl' : 'ltr';
}

export interface MatchLocaleOptions {
  readonly accept?: string;
  readonly cookie?: string;
  readonly path?: string;
  readonly defaultLocale: Locale;
  readonly supported: ReadonlyArray<Locale>;
}

/** Pick the best supported locale: `path` > `cookie` > `accept` > `defaultLocale`. */
export function matchLocale(options: MatchLocaleOptions): Locale {
  const { accept, cookie, path, defaultLocale, supported } = options;
  if (supported.length === 0) return defaultLocale;

  const exact = new Map<string, Locale>();
  const byLanguage = new Map<string, Locale>();
  for (const tag of supported) {
    exact.set(tag.toLowerCase(), tag);
    const lang = languageOf(tag);
    if (!byLanguage.has(lang)) byLanguage.set(lang, tag);
  }

  const tryMatch = (candidate: string | undefined): Locale | undefined => {
    if (!candidate) return undefined;
    const lower = candidate.toLowerCase();
    return exact.get(lower) ?? byLanguage.get(languageOf(lower));
  };

  if (path) {
    const first = path.split('/').filter(Boolean)[0];
    const m = tryMatch(first);
    if (m) return m;
  }
  if (cookie) {
    const m = tryMatch(cookie);
    if (m) return m;
  }
  if (accept) {
    for (const { tag } of parseAcceptLanguage(accept)) {
      const m = tryMatch(tag);
      if (m) return m;
    }
  }
  return defaultLocale;
}

function languageOf(tag: string): string {
  const dash = tag.indexOf('-');
  return (dash === -1 ? tag : tag.slice(0, dash)).toLowerCase();
}

/** Display name for `locale`, expressed in `displayLocale` (defaults to autonym). */
export function getLocaleName(locale: Locale, displayLocale?: Locale): string {
  if (typeof Intl?.DisplayNames !== 'function') return locale;
  try {
    const name = new Intl.DisplayNames([displayLocale ?? locale], { type: 'language' }).of(locale);
    return name ?? locale;
  } catch {
    return locale;
  }
}

export interface LocaleProperties {
  readonly tag: Locale;
  readonly languageCode: string;
  readonly regionCode?: string;
  readonly scriptCode?: string;
  readonly name: string;
  readonly nativeName: string;
  readonly direction: LocaleDirection;
  readonly emoji?: string;
}

export function getLocaleProperties(locale: Locale): LocaleProperties {
  let parsed: Intl.Locale;
  try {
    parsed = new Intl.Locale(locale);
  } catch {
    return {
      tag: locale,
      languageCode: locale,
      name: locale,
      nativeName: locale,
      direction: 'ltr',
    };
  }
  const languageCode = parsed.language ?? locale;
  const regionCode = parsed.region;
  const scriptCode = parsed.script;
  const properties: LocaleProperties = {
    tag: parsed.toString(),
    languageCode,
    ...(regionCode ? { regionCode } : {}),
    ...(scriptCode ? { scriptCode } : {}),
    name: getLocaleName(locale, 'en'),
    nativeName: getLocaleName(locale, locale),
    direction: getDirection(locale),
  };
  const emoji = regionCode ? regionCodeToEmoji(regionCode) : undefined;
  return emoji ? { ...properties, emoji } : properties;
}

/** Flag emoji from a locale's region (e.g. `en-US` → `🇺🇸`). */
export function getLocaleEmoji(locale: Locale): string | undefined {
  let parsed: Intl.Locale;
  try {
    parsed = new Intl.Locale(locale);
  } catch {
    return undefined;
  }
  const region = parsed.region;
  if (!region) return undefined;
  return regionCodeToEmoji(region);
}

function regionCodeToEmoji(region: string): string | undefined {
  if (region.length !== 2) return undefined;
  const upper = region.toUpperCase();
  const a = upper.charCodeAt(0);
  const b = upper.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return undefined;
  // Regional Indicator Symbol Letter A starts at U+1F1E6 (= 'A' + 0x1F1A5).
  return String.fromCodePoint(0x1f1a5 + a, 0x1f1a5 + b);
}

export function isSameLanguage(a: Locale, b: Locale): boolean {
  return languageOf(a) === languageOf(b);
}

/** Pick the best supported locale from an ordered preference list. */
export function determineLocale(
  preferred: ReadonlyArray<Locale>,
  supported: ReadonlyArray<Locale>,
  defaultLocale: Locale,
): Locale {
  if (supported.length === 0) return defaultLocale;
  const exact = new Map<string, Locale>();
  const byLanguage = new Map<string, Locale>();
  for (const tag of supported) {
    exact.set(tag.toLowerCase(), tag);
    const lang = languageOf(tag);
    if (!byLanguage.has(lang)) byLanguage.set(lang, tag);
  }
  for (const candidate of preferred) {
    if (!candidate) continue;
    const lower = candidate.toLowerCase();
    const hit = exact.get(lower) ?? byLanguage.get(languageOf(lower));
    if (hit) return hit;
  }
  return defaultLocale;
}

export interface AcceptLanguageEntry {
  readonly tag: string;
  readonly q: number;
}

/** Parse `Accept-Language` into tags ordered by descending quality. */
export function parseAcceptLanguage(header: string): ReadonlyArray<AcceptLanguageEntry> {
  return header
    .split(',')
    .map((part): AcceptLanguageEntry | undefined => {
      const segments = part.trim().split(';');
      const tag = segments[0]?.trim();
      if (!tag || tag === '*') return undefined;
      let q = 1;
      for (let i = 1; i < segments.length; i++) {
        const s = segments[i]?.trim();
        if (!s) continue;
        if (s.startsWith('q=')) {
          const parsed = Number.parseFloat(s.slice(2));
          if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) q = parsed;
        }
      }
      return q > 0 ? { tag, q } : undefined;
    })
    .filter((entry): entry is AcceptLanguageEntry => entry !== undefined)
    .sort((a, b) => b.q - a.q);
}
