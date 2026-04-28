# Concepts

Four things to understand: catalogs, keys, locales, ICU. Each takes one section.

## Catalogs

A catalog is a JSON file mapping keys to strings (or structured trees) for one
locale.

```jsonc
// .translations/es.json
{
  "Sign out": "Cerrar sesión",
  "Hello, {name}!": "¡Hola, {name}!",
  "t.abc123": [
    /* structured tree */
  ],
}
```

Catalogs live under `outDir` (default `.translations/`). One file per locale,
plus:

- `.meta.json` — per-key context, description, occurrences (file:line)
- `.cache/<sig>.json` — per-(source, target, provider) cache so re-runs are fast

Commit `.translations/` to your repo. Reviewers diff translations the same way
they diff code.

## Keys

Two kinds of key, both derived from your source.

### String-literal keys (from `useT`)

```ts
const t = useT();
t('Sign out'); // key: "Sign out"
t('Hello, {name}!', { name });
```

The literal string is the key. It's also the default rendering when the catalog
misses, so `Sign out` shows up as `Sign out` in any locale that doesn't have a
translation yet.

Disambiguate identical strings with `$context`:

```ts
t('Submit', { $context: 'navbar' }); // key: "Submit@@navbar"
t('Submit', { $context: 'form' }); // key: "Submit@@form"
```

### Structural keys (from `<T>`)

```tsx
<T>
  Hello, <Var>{name}</Var>!
</T>
```

The extractor walks the JSX, normalises whitespace the way React's runtime does,
and hashes the resulting tree. The key is `t.<12-hex>`. You don't write it; you
just edit the JSX and the key follows.

Tag attributes (`href`, `onClick`, `className`) aren't part of the hash — they
ride along with the rendered output but don't invalidate translations when they
change.

## Locales

Locales are BCP-47 tags: `en`, `en-US`, `pt-BR`, `zh-Hans-CN`. autotranslate
treats them as opaque strings — anything `Intl.Locale` accepts works.

The active locale comes from one of:

- `<TranslationProvider locale={locale}>` in React (client + server components)
- `getT(locale)` on the server (Next.js RSC, Remix loaders, route handlers)
- `bindTranslator(translator)` for non-React contexts (zod, async work)

How the locale is _resolved_ (path prefix, cookie, `Accept-Language`) is
framework-specific — see the framework guides.

## ICU MessageFormat

Strings are ICU MessageFormat templates. Three things this gives you:

### Placeholders

```
'Hello, {name}!'
```

```ts
t('Hello, {name}!', { name: 'Ada' }); // → 'Hello, Ada!'
```

### Plurals (CLDR rules per locale)

```
'{count, plural, =0 {No items} one {1 item} other {# items}}'
```

```ts
t('{count, plural, one {# message} other {# messages}}', { count: 3 });
// en → '3 messages'
// ru → '3 сообщения' (correct CLDR few-form)
```

The `<Plural>` JSX marker compiles to the same primitive — pick whichever reads
better at the call site.

### Select (discriminator branches)

```
'{status, select, pending {Pending} shipped {On its way} other {Status: {status}}}'
```

`<Branch>` is the JSX equivalent.

ICU also supports tag wrappers (`<a>...</a>`), nested numbers, dates. The parser
is FormatJS — it handles the full ICU grammar.

## How a render works

```
useT() / <T>
   │
   ▼
locale + catalog  (from TranslationProvider context, or getT, or currentTranslator)
   │
   ▼
key lookup → string (ICU template) or structured tree
   │
   ▼
ICU formatter (placeholders, plurals, select) + tag-wrapper renderer
   │
   ▼
ReactNode
```

Miss in catalog? Falls back to source (the `fallback` prop on the provider, or
the literal key). No throws, no warnings, no broken UI.

## Where to go next

- **[Configuration](reference/configuration.md)** — every option,
  schema-validated
- **[JSX translation](guides/jsx.md)** — `<T>`, markers, tag wrappers
- **[String translation](guides/strings.md)** — `useT`, `useTranslations`
- **[Standalone `t()`](guides/standalone-t.md)** — translate outside React
