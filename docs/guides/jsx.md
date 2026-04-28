# JSX translation

`<T>` is the translatable JSX block. Anything inside it — text, structural
markers (`<Var>`, `<Plural>`, `<Branch>`), formatters, HTML elements, component
wrappers — gets serialised into a canonical message tree, hashed, and looked up
in the active catalog.

```tsx
import { T } from '@autotranslate/react';

<T>Hello, world!</T>;
```

Renders the source string in the source locale and the matching translation
elsewhere. On miss, falls back to `children` verbatim.

## Variable slots — `<Var>`

```tsx
import { T, Var } from '@autotranslate/react';

<T>
  Hello, <Var name="user">{user.name}</Var>!
</T>;
```

- `name` is the slot identifier. Defaults to `'value'`.
- `children` is the runtime substitution.
- The translator sees `Hello, {user}!` and is free to reorder the slot.

When rendered outside `<T>`, `<Var>` passes its children through.

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
  `other` is required.
- `#` in any branch is replaced with the formatted count.

The runtime selects the category via `Intl.PluralRules` for the active locale,
so a single source declaration covers languages with simple two-form plurals
(English) and languages with five-way plurals (Russian).

See [Plurals & branches](plurals.md) for plural-rule details and locale notes.

## Discriminator branches — `<Branch>`

For status / discriminator copy that doesn't fit the plural mould:

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

Round-trips through ICU `select` for translation.

## Tag wrappers

HTML elements and component wrappers inside `<T>` become **tag nodes** in the
canonical tree. Props (`href`, `className`, event handlers) carry over to the
translated output:

```tsx
<T>
  Read the <a href="/docs">documentation</a> for more details.
</T>
```

The extractor strips props from the canonical hash — translators don't see
`href`, and prop changes don't invalidate translations.

For component wrappers, the extractor uses the JSX identifier (e.g. `<Strong>` →
`tag: 'Strong'`). The runtime falls back to `type.displayName` (or `type.name`).

## Whitespace

`<T>` matches React's JSX-runtime whitespace handling. Whitespace-only lines are
dropped, tabs become spaces, leading whitespace on continuation lines is
trimmed, lines join with single spaces.

```tsx
<T>
  Hello,
  <Var>{name}</Var>!
</T>
```

extracts to `Hello, {user}!` — identical to what React renders.

## Context hints

Two identical strings can mean different things. Disambiguate with `context`:

```tsx
<T context="navbar action">Submit</T>
<T context="form button">Submit</T>
```

Each call produces a distinct key. `description` adds a translator-facing
comment without affecting the hash:

```tsx
<T description="Action label on the cart screen.">Submit</T>
```

For [`useT`](strings.md), the same hints come through reserved param keys:
`$context`, `$description`, `$maxChars`.

## Server components

`<T>` works in both client and server components. For server-only translation
without React context, use `getT` from `@autotranslate/react/server` (or
`@autotranslate/next` in Next):

```tsx
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

The `react-server` export condition is wired automatically — the client / server
entries swap based on the consuming module's environment.

## Tips

- **Don't put dynamic expressions inside `<T>` outside markers.** The extractor
  sees the literal AST, not the runtime value:

  ```tsx
  // ❌ {label} is opaque at extract time
  <T>{label}</T>

  // ✅
  <T>
    <Branch branch={label} ['sign-in']={<>Sign in</>}>
      Sign up
    </Branch>
  </T>
  ```

  The [`no-untranslated-jsx`](linting.md) ESLint rule catches the bad case.

- **Wrap whole sentences, not pieces.** `<T>Hello, <Var>{name}</Var>!</T>`
  translates well; `<T>Hello,</T> <Var>{name}</Var><T>!</T>` doesn't — word
  order varies by language.

- **One `<T>` per logical message.** If you nest `<T>` blocks, each is hashed
  independently — the inner one is opaque to the outer.
