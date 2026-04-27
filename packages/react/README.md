# @autotranslate/react

React adapter for
[autotranslate](https://github.com/tamimbinhakim/autotranslate). `<T>` for
translatable JSX, `<Var>` / `<Plural>` / `<Branch>` markers for structural
slots, `<Num>` / `<Currency>` / `<DateTime>` / `<RelativeTime>` for locale-aware
formatting, and a separate server entry for RSC / SSR.

```bash
pnpm add @autotranslate/react @autotranslate/core
```

## Quick features

- **`<T>` for translatable JSX.** Walks children, derives a canonical tree,
  looks up the translation, and renders it using the original markup as
  templates — `<a href>` and event handlers carry over.
- **`useT` for plain strings.** Drop-in `(key, params?) => string` for button
  labels, `aria-*`, and anything that isn't JSX.
- **Slot markers.** `<Var>`, `<Plural>`, `<Branch>` for structure; `<Num>`,
  `<Currency>`, `<DateTime>`, `<RelativeTime>` for `Intl.*`.
- **RSC-aware.** Separate `@autotranslate/react/server` entry. The
  `react-server` export condition is wired so Next.js App Router picks the right
  entry automatically.
- **Type-narrowed keys.** When `autotranslate generate-types` has run, `useT()`
  autocompletes the catalog and rejects unknown keys.

## Quick start

```tsx
import {
  Plural,
  T,
  TranslationProvider,
  useT,
  Var,
} from '@autotranslate/react';

export function App() {
  return (
    <TranslationProvider locale="es" catalog={es} fallback={en}>
      <Greeting name="Ada" count={3} />
    </TranslationProvider>
  );
}

function Greeting({ name, count }: { name: string; count: number }) {
  const t = useT();
  return (
    <>
      <h1>
        <T>
          Hello, <Var name="name">{name}</Var>!
        </T>
      </h1>
      <p>
        <T>
          You have <Plural value={count} one="1 message" other="# messages" />.
        </T>
      </p>
      <button type="button">{t('Sign out')}</button>
    </>
  );
}
```

## Components

### `<TranslationProvider locale catalog? fallback? children />`

Wraps your tree with locale + catalog context. `catalog` is the active-locale
map; `fallback` is the source-locale map used when a key is missing. Without a
provider the runtime degrades to source rendering — no errors, no warnings.

### `<T>...</T>`

Translatable JSX block. Walks `children`, derives a canonical
`StructuredMessage`, hashes it to a key, and looks up the translation. On hit,
the translated tree is rendered using the original `<Var>` / `<Plural>` / HTML
elements as templates. On miss, renders `children` verbatim.

### `<Var name?>{value}</Var>`

Variable slot inside `<T>`. `name` defaults to `value`.

### `<Plural value name? zero? one? two? few? many? other />`

Plural branch inside `<T>`. CLDR category is selected per the active locale via
`Intl.PluralRules`. `#` in any branch is replaced with the formatted count.
`name` defaults to `count`.

### `<Branch branch name? ...cases>{default}</Branch>`

Discriminator branch inside `<T>`. Every prop other than `branch`, `name`, and
`children` is a named case. `children` is the default fallback.

```tsx
<T>
  <Branch
    branch={status}
    pending={<>Pending review</>}
    shipped={<>On its way</>}
  >
    Status: <Var>{status}</Var>
  </Branch>
</T>
```

### `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>`

`Intl.*`-backed locale-aware formatters. Inside `<T>`, they're treated as opaque
variable slots — the formatter renders itself.

## Hooks

### `useT()`

Returns `(key, params?) => string` bound to the active locale + catalog.

### `useTranslations(namespace?)`

Curries `useT` with a `namespace.` prefix. Mirrors dictionary-mode patterns from
`next-intl` / `react-intl`.

```ts
const t = useTranslations('dashboard');
t('title'); // → catalog['dashboard.title']
```

### `useLocale()`

Returns the active locale string.

## Server entry

Synchronous-friendly translator factories for RSC, SSR, route handlers, and edge
functions — no React context involved.

```ts
import { getT } from '@autotranslate/react/server';

export default async function Page() {
  const t = await getT('es', () => loadCatalog('es'), () => loadCatalog('en'));
  return <h1>{t.t('Welcome')}</h1>;
}
```

| Export             | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `getT`             | Async factory — calls your catalog loader(s)  |
| `createTranslator` | Synchronous factory (re-exported from `core`) |

The `react-server` export condition is wired so Next.js App Router / RSC
bundlers pick this entry automatically when compiling server components.

## API

- `<T>`, `<Var>`, `<Plural>`, `<Branch>`, `<Num>`, `<Currency>`, `<DateTime>`,
  `<RelativeTime>`, `<TranslationProvider>`
- `useT`, `useTranslations`, `useLocale`, `useTranslationContext`
- `TranslationContext`, `AutotranslateCatalog` (interface, augmented by
  `autotranslate generate-types`), `CatalogKey`
- Types: `TProps`, `VarProps`, `PluralProps`, `BranchProps`, `NumProps`,
  `CurrencyProps`, `DateTimeProps`, `RelativeTimeProps`,
  `TranslationProviderProps`, `TranslationContextValue`
