# Translating JSX

`<T>` is the translatable JSX block. Anything inside it — text, structural
markers (`<Var>`, `<Plural>`, `<Branch>`), formatters (`<Num>`, `<Currency>`,
`<DateTime>`, `<RelativeTime>`), HTML elements, and component wrappers — gets
serialized into a canonical message tree, hashed, and looked up in the active
catalog.

## The basics

```tsx
import { T } from '@autotranslate/react';

<T>Hello, world!</T>;
```

This renders `Hello, world!` in the source locale and the matching translation
in any target locale that has a catalog entry. On miss, it falls back to
`children` verbatim.

## Variable slots — `<Var>`

`<Var>` is a structural marker for runtime values. It tells the extractor where
the dynamic slot is so the canonical key stays stable across translations.

```tsx
import { T, Var } from '@autotranslate/react';

<T>
  Hello, <Var name="user">{user.name}</Var>!
</T>;
```

- `name` is the slot identifier. It defaults to `'value'`.
- `children` is the runtime substitution.
- The translator sees `Hello, {user}!` and is free to reorder the slot (e.g.
  `¡Hola, {user}!`, `{user}さん、こんにちは！`).

When rendered outside `<T>`, `<Var>` passes its children through, so it composes
safely with normal JSX.

## Plurals — `<Plural>`

```tsx
import { Plural, T } from '@autotranslate/react';

<T>
  You have <Plural value={count} one="1 message" other="# messages" />.
</T>;
```

- `value` is the count.
- `name` is the slot identifier (defaults to `'count'`).
- `zero`, `one`, `two`, `few`, `many`, `other` are CLDR plural categories.
  `other` is required at extraction time.
- `#` in any branch is replaced with the formatted count.

The runtime selects the category via `Intl.PluralRules` for the active locale,
so a single source declaration covers languages with simple two-form plurals
(English) and languages with five-way plurals (Russian).

Outside `<T>`, `<Plural>` returns `null` — the renderer-driven path is the only
documented entry. If you need standalone plural selection, build it on top of
[`getPluralCategory`](../api-reference.md#core).

## Discriminator branches — `<Branch>`

`<Branch>` covers status / discriminator copy that doesn't fit the plural mold:

```tsx
import { Branch, T, Var } from '@autotranslate/react';

<T>
  <Branch
    branch={status}
    pending={<>Pending review</>}
    shipped={<>On its way</>}
    delivered={<>Delivered</>}
  >
    Status: <Var>{status}</Var>
  </Branch>
</T>;
```

- `branch` is the discriminator value (coerced to string).
- `name` is the slot identifier (defaults to `'branch'`).
- Every prop other than `branch`, `name`, and `children` is a named case.
- `children` is the default fallback when no case matches.

`<Branch>` round-trips through ICU `select` for AI translation.

## Tag wrappers

HTML elements and component wrappers inside `<T>` become **tag nodes** in the
canonical tree. The runtime keeps the original element as a template, so props
(`href`, `className`, event handlers) carry over to the translated output:

```tsx
<T>
  Read the <a href="/docs">documentation</a> for more details.
</T>
```

The extractor strips props from the canonical hash — translators don't see
`href` or `onClick`, and prop changes don't invalidate translations.

For component wrappers, the extractor uses the JSX identifier (e.g. `<Strong>` →
`tag: 'Strong'`). The runtime falls back to `type.displayName` (or `type.name`)
when reconstructing the tag.

## Whitespace

`<T>` matches React's JSX-runtime whitespace handling. Whitespace-only lines are
dropped, tabs become spaces, leading whitespace on continuation lines is
trimmed, and lines are joined with single spaces.

```tsx
<T>
  Hello,
  <Var>{name}</Var>!
</T>
```

extracts to `Hello, {user}!` with a single space between segments — identical to
what React renders at runtime.

## Context hints

Two identical strings can mean different things in different places (e.g.
"Submit" as a navbar action vs. a form button). Disambiguate with the `context`
prop on `<T>`:

```tsx
<T context="navbar action">Submit</T>
<T context="form button">Submit</T>
```

The context mixes into the hash, so each call produces a distinct key.
`description` adds a translator-facing comment without affecting the hash.

```tsx
<T description="Action label on the cart screen.">Submit</T>
```

For [`useT`](translating-strings.md), the same hints come through `params` keys:
`$context`, `$description`, `$maxChars`.

## Server components

`<T>` works in both client and server components. For server-only translation
without React context, use the
[server entry](../api-reference.md#autotranslatereact-server):

```tsx
import { getT } from '@autotranslate/react/server';

export default async function Page() {
  const t = await getT('es', () => loadCatalog('es'));
  return <h1>{t.t('Welcome')}</h1>;
}
```

In Next.js, the `react-server` export condition is wired automatically. See the
[Next.js guide](../frameworks/nextjs.md) for the full setup.

## Tips

- **Don't put dynamic expressions inside `<T>` outside markers.** The extractor
  sees the literal AST, not the runtime value:

  ```tsx
  // ❌ {label} is opaque at extract time
  <T>{label}</T>

  // ✅
  <T>{label === 'sign-in' ? <>Sign in</> : <>Sign up</>}</T>
  // … or
  <T>
    <Branch branch={label} ['sign-in']={<>Sign in</>}>
      Sign up
    </Branch>
  </T>
  ```

  The [`no-untranslated-jsx`](../guides/eslint.md) ESLint rule catches the bad
  case.

- **Wrap whole sentences, not pieces.** `<T>Hello, <Var>{name}</Var>!</T>`
  translates well; `<T>Hello,</T> <Var>{name}</Var><T>!</T>` doesn't — word
  order varies by language.

- **One `<T>` per logical message.** If you nest `<T>` blocks, each is hashed
  independently — the inner one is opaque to the outer.
