# Migrating from react-i18next

The shape change: `react-i18next` is **JSON-first** (you author keys in JSON
catalogs, reference them in code via `t('key.path')`). autotranslate is
**code-first** (you write the literal string, the catalog is generated). The
migration is mostly removing keys.

## At a glance

<!-- prettier-ignore -->
```tsx
// Plain string lookup
t('hello.world');                                 // react-i18next — needs JSON: { hello: { world: 'Hello' } }
t('Hello');                                       // autotranslate — the literal IS the key

// Rich text
<Trans>Hello <strong>{{name}}</strong></Trans>;   // react-i18next
<T>Hello <strong><Var>{name}</Var></strong></T>;  // autotranslate

// Plural — react-i18next: needs `items_one` / `items_other` keys
t('items', { count });
// autotranslate: one inline ICU source covers every CLDR form
t('{count, plural, one {# item} other {# items}}', { count });

// Language switch
i18next.changeLanguage('fr');                                  // react-i18next — mutates global state
<TranslationProvider locale="fr" catalog={catalogs.fr} />;     // autotranslate — re-render with new locale

// On-disk shape
// react-i18next   public/locales/{lng}/translation.json   (handwritten)
// autotranslate   .translations/{locale}/**.json          (generated)
```

## Step-by-step

### 1. Replace runtime

```bash
pnpm remove react-i18next i18next i18next-http-backend i18next-browser-languagedetector
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
npx autotranslate init
```

### 2. Move existing translations into `overrides`

Your hand-curated translations are precious. Don't lose them. Convert your JSON
catalogs into autotranslate `overrides` keyed by source string:

```ts
// before: public/locales/fr/translation.json
{ "hello": { "world": "Bonjour" } }
// and the source code: t('hello.world') with English fallback "Hello"

// after: autotranslate.config.ts
overrides: {
  fr: {
    'Hello': 'Bonjour',
  },
}
```

Write a one-shot script if your old catalog is large. The keys become the
source-locale string, the values stay the same.

### 3. Replace the provider

```tsx
// before — i18next bootstrap
import i18n from './i18n';
<I18nextProvider i18n={i18n}>
  <App />
</I18nextProvider>;

// after
import { TranslationProvider } from '@autotranslate/react';
<TranslationProvider locale={locale} catalog={catalog} fallback={enCatalog}>
  <App />
</TranslationProvider>;
```

The `<TranslationProvider>` reads its catalog from props — load them with
`@autotranslate/vite`'s virtual module, `@autotranslate/next`'s
`fsCatalogLoader`, or direct JSON imports.

### 4. Replace `useTranslation`

```tsx
// before
const { t } = useTranslation();
t('hello.world');
t('user.greeting', { name: user.name });
t('items', { count });

// after
const t = useT();
t('Hello');
t('Hi, {name}!', { name: user.name });
t('{count, plural, one {# item} other {# items}}', { count });
```

The literal string is the key. Drop the keypath system entirely.

### 5. Replace `<Trans>`

```tsx
// before
<Trans i18nKey="welcome">
  Welcome to <strong>{{ brand: 'autotranslate' }}</strong>!
</Trans>;

// after
import { T, Var } from '@autotranslate/react';
<T>
  Welcome to{' '}
  <strong>
    <Var name="brand">autotranslate</Var>
  </strong>
  !
</T>;
```

The `<T>` block hashes its children — no need for an `i18nKey`. Use `<Var>` for
runtime values, regular HTML/component tags for formatting.

### 6. Replace plurals

```tsx
// before — JSON: items_one, items_other
t('items', { count })

// after — inline ICU OR <Plural>
t('{count, plural, one {# item} other {# items}}', { count })
// or
<T>You have <Plural value={count} one="1 item" other="# items" />.</T>
```

Drop the `_one` / `_other` JSON conventions. ICU `plural` covers all CLDR
categories (`zero`, `one`, `two`, `few`, `many`, `other`) and the runtime picks
the right form per locale.

### 7. Replace language switching

```tsx
// before
i18n.changeLanguage('fr');

// after — re-render with new locale
const [locale, setLocale] = useState('en');
<TranslationProvider locale={locale} catalog={catalogs[locale]}>
```

See the [locale switcher cookbook](../cookbook/locale-switcher.md).

### 8. Run the pipeline

```bash
npx autotranslate extract       # scan source → en.json (chunked)
npx autotranslate translate     # AI-translate to targets, applying overrides
npx autotranslate generate-types
```

Your old hand-curated translations from step 2 become the source of truth where
they exist; everything else gets AI-translated and you can tweak results via
further `overrides` or by editing the chunk files (re-runs only re-translate
changed strings).

### 9. Delete the old setup

```bash
rm -rf public/locales/
rm src/i18n.ts   # or wherever i18next was bootstrapped
```

## Server-side rendering

`react-i18next` users typically pair with `i18next-http-backend` and a custom
`serverSideTranslations` helper. autotranslate's server flow is simpler:

```tsx
// Next.js
import { getT } from '@autotranslate/next';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getT(lang);
  return <h1>{t.t('Welcome')}</h1>;
}
```

See the [Next.js framework guide](../frameworks/nextjs.md).

## Things that don't have a direct equivalent

- **`i18next.exists(key)`** — autotranslate doesn't fail on missing keys; it
  falls back to source. So checking existence isn't necessary.
- **Multiple namespaces (`useTranslation('common')`)** — closest equivalent is
  the dictionary mode (`useTranslations('common')`) plus the `dictionary` config
  field.
- **Lazy resource loading per namespace** — see the
  [lazy-loading cookbook](../cookbook/lazy-loading.md).

## Common gotchas

- **`<Trans>` `t` defaults vs. `<T>` semantics**. `<Trans>` renders `i18nKey` as
  default if no translation exists. `<T>` renders `children` verbatim. The
  behaviour is similar but the failure modes differ — always provide meaningful
  English in `<T>`.
- **Variable names changed**. `i18next` allows `{{varName}}`; autotranslate uses
  `{varName}` (single braces, ICU style). Don't try to translate the doubles.
- **Plural pluralization rules differ**. `i18next` defaults to "ICU-like" but
  with non-CLDR fallbacks. autotranslate is strictly CLDR via
  `Intl.PluralRules`. If you had Russian-specific plurals coded by hand, the new
  behavior is more correct but may produce different forms.

## Next

- [Quick start](../quick-start.md)
- [Translating JSX](../guides/jsx.md)
- [Translating strings](../guides/strings.md)
- [Locale switcher cookbook](../cookbook/locale-switcher.md)
