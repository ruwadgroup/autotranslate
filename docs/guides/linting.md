# Linting

`@autotranslate/eslint-plugin` catches untranslated copy and broken keys at
write time, before the extractor runs.

## Install

```bash
pnpm add -D @autotranslate/eslint-plugin
```

## Use (flat config, ESLint v9+)

```js
// eslint.config.js
import autotranslate from '@autotranslate/eslint-plugin';

export default [autotranslate.configs.recommended];
```

## Use (legacy `.eslintrc`)

```jsonc
{
  "plugins": ["@autotranslate"],
  "extends": ["plugin:@autotranslate/recommended-legacy"],
}
```

## Rules

### `no-untranslated-jsx`

Flags user-visible string literals inside JSX that aren't wrapped in a
translation marker (`<T>`, `<Var>`, `<Plural>`, `<Branch>`, `<Num>`,
`<Currency>`, `<DateTime>`, `<RelativeTime>`).

```jsx
<p>Hello</p>                    // ❌ bare text outside <T>
<button title="Save">x</button> // ❌ untranslated attribute
<T>Hello</T>                    // ✓
```

Options:

```js
{
  rules: {
    '@autotranslate/no-untranslated-jsx': ['warn', {
      allowAttributes: ['placeholder'],
      markers: ['MyTranslatedThing'],
    }],
  },
}
```

| Option            | Type       | Default | Effect                                                        |
| ----------------- | ---------- | ------- | ------------------------------------------------------------- |
| `allowAttributes` | `string[]` | `[]`    | Extra attributes that may carry untranslated string literals. |
| `markers`         | `string[]` | `[]`    | Extra components treated as translation markers.              |

A built-in allowlist covers structural / locale-neutral attributes (`className`,
`id`, `key`, `ref`, `name`, `type`, `role`, `slot`, `style`, `data-*`, `href`,
`src`, `alt`, `lang`, `dir`, and others).

#### `no-untranslated-jsx` in auto mode

When `mode: 'auto'` is set in `autotranslate.config.ts`, the compiler wraps
qualifying JSX text in `<T>` at build time before the lint rule runs. This means
the rule will not fire for JSX text nodes that the compiler handles.

The compiler also translates **host-element copy attributes** (`title`,
`aria-label`, `placeholder`, …) in `"use client"` files. Pass `autoMode: true`
so the rule doesn't double-flag those:

```js
'@autotranslate/no-untranslated-jsx': ['warn', { autoMode: true }],
```

With `autoMode`, the rule stays quiet on host-element attributes in client
modules (the compiler handles them) but keeps flagging the cases the compiler
leaves alone: **server-component** attributes (no `"use client"`) and
**custom-component** copy props. Leave `autoMode` off in `explicit` mode.

The rule also recognizes bare copy-bearing expressions such as `{title}` and
`{item.label}`. Auto mode resolves these through statically extracted prop or
config values; explicit mode should wrap them or translate their source strings
with `useT()`.

The rule and the compiler share the same classifier: `code`, `pre`, `script`,
and `style` elements are skipped by both, and `data-no-translate` suppresses
both the compiler and the lint warning on any element and its subtree.

### `no-dynamic-key`

Translator calls (`t(...)` from `useT()` / `getT()` / standalone `t`) must use
string-literal keys. Dynamic keys break extraction.

```js
const t = useT();
t('Sign out'); // ✓
t(`Sign out`); // ✓
t(KEY); // ✓ - KEY is a local string-literal const
t(`prefix.${id}`); // ❌ - dynamic key, can't be extracted
t(label); // ❌
```

Identifier references to a same-file string literal are allowed - the rule walks
scope to confirm the binding is a static string.

### `valid-icu-format`

Parses ICU MessageFormat on every literal key. Catches mismatched braces and
malformed plural / select arms before runtime.

```js
t('Hello, {name}!'); // ✓
t('{count, plural, one {# item} other {# items}}'); // ✓
t('Hello, {name'); // ❌ unclosed
t('{count, plural, =0 {none}'); // ❌ malformed
```

## Recommended config

The bundled `recommended` preset wires every rule at appropriate severity:

```js
{
  rules: {
    '@autotranslate/no-untranslated-jsx': 'warn',
    '@autotranslate/no-dynamic-key': 'error',
    '@autotranslate/valid-icu-format': 'error',
  },
}
```

`no-untranslated-jsx` is `warn` because it's intentionally noisy during
migrations; bump to `error` once your tree is fully wrapped.

## Tips

- **Run on every commit.** Wire ESLint into `lint-staged` so dynamic keys and
  bare JSX literals never land in main.

- **Combine with [type safety](typesafety.md).** `no-dynamic-key` guarantees the
  extractor can see every key; typegen guarantees every key the code references
  is actually in the catalog.

- **Custom marker components.** If you wrap `<T>` in a project-specific
  component (e.g. `<Translated>`), add it to `markers` so the rule doesn't flag
  its children.

- **`data-no-translate`.** Add this attribute to any element (a version badge, a
  code snippet, a logo text) to suppress the warning for that element and its
  entire subtree.
