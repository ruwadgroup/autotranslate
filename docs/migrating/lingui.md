# Migrating from lingui

`lingui` (`@lingui/react`, `@lingui/core`) is the closest existing library to
autotranslate's philosophy: code-first authoring, message extraction via macros,
ICU MessageFormat. The migration is mostly swapping macros for `<T>` / `useT`
and replacing the catalog format.

## At a glance

<!-- prettier-ignore -->
```tsx
// Rich text
<Trans>Hello <strong>{name}</strong>!</Trans>;                 // lingui (Trans macro)
<T>Hello <strong><Var>{name}</Var></strong>!</T>;              // autotranslate - wrap dynamic in <Var>

// Plain string
t`Hello, ${name}!`;                                            // lingui - tagged template
t('Hello, {name}!', { name });                                 // autotranslate - literal + ICU placeholder

// Plural
plural(count, { one: '# item', other: '# items' });            // lingui
t('{count, plural, one {# item} other {# items}}', { count }); // autotranslate

// Build pipeline
lingui extract && lingui compile                               // lingui
autotranslate extract && autotranslate translate               // autotranslate

// Catalog
// lingui          locale/{locale}/messages.po (or .json)
// autotranslate   .translations/{locale}/**.json (hash-bucketed, generated)

// Provider
<I18nProvider i18n={i18n}>;                                    // lingui
<TranslationProvider locale={locale} catalog={catalog}>;       // autotranslate
```

## The fast path: `mode: 'auto'`

Before manually wrapping every JSX text node, enable `mode: 'auto'` in your
config. The compiler inserts `<T>` around plain JSX text at compile time - you
do not touch existing components.

```ts
// autotranslate.config.ts
export default defineConfig({
  mode: 'auto',
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
});
```

You only need explicit `<T>` where you want `<Var>`, `<Plural>`, or `<Branch>`
markers for runtime slots. Everything else is wrapped automatically. See
[Configuration](../reference/configuration.md#mode).

## Step-by-step

### 1. Swap runtime

```bash
pnpm remove @lingui/react @lingui/core @lingui/cli @lingui/macro \
  babel-plugin-macros @lingui/babel-plugin-extract-messages
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
npx autotranslate init
```

Drop `babel-plugin-macros` and the lingui Babel-plugin entries from
`babel.config.js` / `.swcrc`. autotranslate's extractor runs at CLI time against
your source AST - no runtime or compile-time plugins required.

### 2. Replace macros

```tsx
// before - Lingui macros
import { Trans, t } from '@lingui/macro';

<Trans>Hello, <strong>{user.name}</strong>!</Trans>
<button>{t`Sign out`}</button>

// after
import { T, Var, useT } from '@autotranslate/react';

<T>Hello, <strong><Var>{user.name}</Var></strong>!</T>;

function SignOutButton() {
  const t = useT();
  return <button>{t('Sign out')}</button>;
}
```

The key mechanical change: every variable inside `<T>` needs `<Var>` (or another
marker like `<Plural>`, `<Branch>`). This is what makes canonical-key derivation
deterministic. With `mode: 'auto'`, the compiler handles this for simple cases
automatically.

### 3. Replace `t` tagged-template usage

```tsx
// before
const message = t`Welcome, ${user.name}!`;

// after
const t = useT();
const message = t('Welcome, {name}!', { name: user.name });

// or - if outside React
import { t } from '@autotranslate/core/t';
const message = t('Welcome, {name}!', { name: user.name });
```

### 4. Replace `plural` / `select`

```tsx
// before - lingui macro
import { plural } from '@lingui/macro';
plural(count, { one: '# message', other: '# messages' });

// after - inline ICU
const t = useT();
t('{count, plural, one {# message} other {# messages}}', { count });

// or, in JSX
<T>
  You have <Plural value={count} one="1 message" other="# messages" />.
</T>;
```

### 5. Move existing translations into `overrides`

Lingui's catalogs (`locales/{locale}/messages.po` or `messages.json`) are keyed
by the source string by default. Convert into `overrides`:

```ts
// before - locales/fr/messages.json
{ "Sign out": { "translation": "Se déconnecter" } }

// after - autotranslate.config.ts
overrides: {
  fr: {
    'Sign out': 'Se déconnecter',
  },
}
```

For very large catalogs, write a quick Node script to read the JSON catalog and
emit a `.ts` file with the overrides shape.

### 6. Replace the provider

```tsx
// before
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';

i18n.load(locale, messages);
i18n.activate(locale);

<I18nProvider i18n={i18n}>{children}</I18nProvider>;

// after
import { TranslationProvider } from '@autotranslate/react';
import * as catalogModule from '../.translations';

const [catalog, fallback] = await Promise.all([
  catalogModule.loadCatalog(locale),
  catalogModule.loadCatalog('en'),
]);

<TranslationProvider locale={locale} catalog={catalog} fallback={fallback}>
  {children}
</TranslationProvider>;
```

`import * as catalogModule from '../.translations'` imports the generated
`<outDir>/index.ts` module. Its `loadCatalog(locale)` uses static `import()` so
the bundler code-splits per locale.

### 7. Replace `i18n.activate` (locale switching)

```tsx
// before
i18n.activate('fr');

// after - re-render with new locale prop
const [locale, setLocale] = useState('en');
<TranslationProvider locale={locale} catalog={catalogs[locale]}>
```

See [locale switcher cookbook](../cookbook/locale-switcher.md).

### 8. Run the pipeline

```bash
npx autotranslate extract        # finds <T>, useT(), standalone t() calls
npx autotranslate translate      # AI-translate (with overrides applied last)
npx autotranslate generate-types # narrow keys at compile time
```

### 9. Delete the lingui setup

```bash
rm -rf locales/
rm lingui.config.js
# remove babel-plugin-macros / lingui plugin from babel/swc config
```

## Things that don't translate cleanly

- **`<Trans id>` with explicit message id.** Lingui supports
  `<Trans id="form.submit">Submit</Trans>` to give the catalog an alphanumeric
  id separate from the source. autotranslate doesn't have this - the source IS
  the key. Disambiguate identical strings with `context`:

  ```tsx
  <T context="cart">Submit</T>
  <T context="settings">Submit</T>
  ```

- **`.po` workflow with translators.** Lingui can export to GNU `.po` for
  translators to edit. autotranslate doesn't ship a `.po` exporter today. You
  can write a small script to convert `.translations/{locale}/**.json` to `.po`
  for human translators, then import the results back as `overrides`.

- **Pseudo-locale at compile time.** Lingui's `cli compile --pseudoLocale` bakes
  pseudo-localized strings into a build. autotranslate's pseudo works at the
  provider level: `provider: { name: 'stub', pseudo: true }`. Run
  `autotranslate translate` once with this provider and you have a pseudo locale
  committed.

- **The `id` extraction option (`extract --idStrategy=...`).** autotranslate
  always uses the source string as the literal key (or a structural hash for
  `<T>` blocks). No alternative id strategies.

## Next

- [Quick start](../quick-start.md)
- [Translating JSX](../guides/jsx.md)
- [Plurals & branches](../guides/plurals.md)
