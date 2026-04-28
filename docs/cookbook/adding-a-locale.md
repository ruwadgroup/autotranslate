# Adding a new locale

Three steps from "no German" to "full German support."

## 1. Add to `targets`

```ts
// autotranslate.config.ts
export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja', 'de'], // ← added
  // …
});
```

## 2. Translate

```bash
npx autotranslate translate
```

Only the new locale gets translated — the cache for existing locales stays
intact.

```
.translations/de.json    ← created
.translations/.cache/<sig>.json    ← updated (new locale entries)
```

## 3. Wire it into your runtime

### Vite

The virtual module re-exports automatically — `locales` now includes `de`. HMR
re-runs the dev server.

### Next.js

Add the locale to your proxy config:

```ts
// proxy.ts
export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja', 'de'], // ← added
});
```

And to the layout's supported set:

```tsx
const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja', 'de'] as const;
```

### Locale switcher

Add the option to your switcher:

```ts
const SUPPORTED = [
  // …
  { code: 'de', label: 'Deutsch' },
];
```

## 4. Verify

```bash
npx autotranslate check
```

Reports missing keys, orphan keys, and ICU parse errors per locale. After the
new translate run, `de` should be at parity with the others.

## Removing a locale

Reverse: drop it from `targets`, delete the JSON file, run `autotranslate check`
to confirm no orphan references. The cache entries stay (harmless) until the
next run rewrites them.

## Adding a regional variant

`en-GB` alongside `en`:

```ts
targets: ['es', 'fr', 'ja', 'de', 'en-GB'],
```

The runtime treats `en-GB` and `en` as different keys; CLDR plural rules inherit
from the base language. For partial overlap, use overrides:

```ts
overrides: {
  'en-GB': {
    'Color': 'Colour',
    'Favorite': 'Favourite',
  },
},
```

`overrides` apply _after_ machine translation, so most of the catalog can be
machine-generated and only the British-spelling deltas are hand-tuned.

## RTL

Set `<html dir>` per locale. `getDirection(locale)` from
`@autotranslate/core/locale` returns `'rtl'` for Arabic, Hebrew, Persian, Urdu:

```tsx
import { getDirection } from '@autotranslate/core/locale';

<html lang={locale} dir={getDirection(locale)}>
```

## Tips

- **Translate locales independently.** `--locale de fr` runs a subset; useful
  during a heavy dictionary-rewrite pass when you don't want to retranslate the
  whole tree.

- **Pin a fallback chain.** If a translation for `pt-BR` is missing, fall
  through to `pt`, then `en`. Set `fallback={catalogs.en}` on the
  `TranslationProvider`; for `pt-BR → pt`, build a merged catalog at load time.

- **Don't ship empty locales.** A blank catalog renders source for every string.
  Either translate or remove from `targets`.
