# @autotranslate/react

React adapter for
[autotranslate](https://github.com/tamimbinhakim/autotranslate). `<T>` for
translatable JSX blocks, `<Var>` / `<Plural>` for slot markers, `useT` for
plain-string translation, and a separate server entry for RSC / SSR.

```bash
pnpm add @autotranslate/react @autotranslate/core
```

## Usage

```tsx
import {
  T,
  Var,
  Plural,
  TranslationProvider,
  useT,
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

Wraps your app with locale + catalog context. `catalog` is the active-locale
map; `fallback` is the source-locale map used when a key is missing from the
active catalog. Without a provider the runtime degrades to source rendering (no
errors, no warnings).

### `<T>...</T>`

Translatable JSX block. Walks `children`, derives a canonical
`StructuredMessage`, hashes it to a key, and looks up the translation in the
active catalog. On hit, the translated tree is rendered using the original
`<Var>` / `<Plural>` / HTML elements as templates — so props like `<a href>` and
event handlers carry over to the translated output. On miss, renders `children`
verbatim.

### `<Var name?>{value}</Var>`

Variable slot inside `<T>`. `name` defaults to `value`. Children are the runtime
substitution.

### `<Plural value name? zero? one? two? few? many? other />`

Plural branch inside `<T>`. `name` defaults to `count`. CLDR category is
selected per the active locale via `Intl.PluralRules`; `#` in any branch is
replaced with the formatted count.

## Hooks

### `useT()`

Returns `(key, params?) => string`. Use this for plain-string translation —
button labels, `aria-*` attributes, anything that isn't JSX.

### `useLocale()`

Returns the active locale.

## Server entry (`@autotranslate/react/server`)

Synchronous-friendly translator factories for RSC, SSR, route handlers, edge
functions, etc. — no React context involved.

```ts
import { getT } from '@autotranslate/react/server';

export default async function Page() {
  const t = await getT('es', () => loadCatalog('es'), () => loadCatalog('en'));
  return <h1>{t('Welcome')}</h1>;
}
```

| Export             | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `getT`             | Async factory — calls your catalog loader(s)  |
| `createTranslator` | Synchronous factory (re-exported from `core`) |

The `react-server` export condition is wired so Next.js App Router / RSC
bundlers pick this entry automatically when compiling server components.

## Public API

- `<T>`, `<Var>`, `<Plural>`, `<TranslationProvider>`
- `useT`, `useLocale`
- `useTranslationContext`, `TranslationContext`
- Types: `TProps`, `VarProps`, `PluralProps`, `TranslationProviderProps`,
  `TranslationContextValue`
