# Concepts

Four things to understand: catalogs, keys, locales, ICU. Each takes one section.

## Catalogs

A catalog is a JSON file mapping keys to strings (or structured trees) for one
locale.

```jsonc
// .translations/es/3.json
{
  "3a4f9b8c2d1e": "Cerrar sesión",
  "3b7c1d4e2f8a": "¡Hola, {name}!",
  "t.3abc123def45": [
    /* structured tree */
  ],
}
```

Keys are 12-char SHA-256 prefixes of the source string (or the canonical
structured tree for `<T>` blocks). The literal source is what you write in code;
hashing happens at extract / lookup time, transparent to you.

Catalogs live under `outDir` (default `.translations/`). The on-disk shape is
**hash-bucketed**: one folder per locale, 16 files per folder by default, named
by the first hex digit of the key:

```
.translations/
  en/   0.json   1.json   ...   f.json    # source locale
  es/   0.json   1.json   ...   f.json    # mirror — same keys, translated values
  fr/   0.json   1.json   ...   f.json
  .meta.json                                # per-key context, description, occurrences
  .cache/<sig>.json                         # per-(source, target, provider) cache
```

Same hash → same bucket file across every locale. So `en/3.json`, `es/3.json`,
and `fr/3.json` carry the same key set, just with different translated values —
you can `diff en/3.json es/3.json` to audit cross-locale parity.

Commit `.translations/` to your repo. Reviewers diff translations the same way
they diff code.

Bucket count is tunable via `catalog.chunkBits` (default `4` = 16 buckets; `0`
for a single flat file per locale; up to `12` for 4096 buckets on
enterprise-scale catalogs).

## Keys

Two kinds of key, both derived from your source.

### String-literal keys (from `useT`)

```ts
const t = useT();
t('Sign out'); // storage key: hash12("Sign out") = "3a4f9b8c2d1e"
t('Hello, {name}!', { name });
```

The literal string in your code IS the key from your perspective; the runtime
hashes it (12-char SHA-256 prefix) before looking it up in the catalog. The
literal also serves as the fallback when the catalog misses — `Sign out` shows
up as `Sign out` in any locale that doesn't have a translation yet.

Disambiguate identical strings with `$context`:

```ts
t('Submit', { $context: 'navbar' }); // storage key: hash12("Submit@@navbar")
t('Submit', { $context: 'form' }); // storage key: hash12("Submit@@form")
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
