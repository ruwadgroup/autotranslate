# ESLint plugin

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

export default [
  autotranslate.configs.recommended,
  // …other config blocks
];
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
<T>Hello</T>                    // ✅
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
`src`, `alt`, `lang`, `dir`, …).

### `no-dynamic-key`

Translator calls (`t(...)` from `useT()` / `useTranslations()` / `getT()` /
`getTranslations()`) must use string-literal or
template-literal-without-expressions keys. Dynamic keys break extraction.

```js
const t = useT();
t('Sign out'); // ✅
t(`Sign out`); // ✅
t(KEY); // ✅ — KEY is a local string-literal const
t(`prefix.${id}`); // ❌ — dynamic key, can't be extracted
t(label); // ❌
```

Identifier references to a same-file string literal are allowed — the rule walks
scope to confirm the binding is a static string.

### `valid-icu-format`

Parses ICU MessageFormat on every literal key passed to a translator. Catches
mismatched braces and malformed plural / select arms before runtime.

```js
t('Hello, {name}!'); // ✅
t('{count, plural, one {# item} other {# items}}'); // ✅
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
migrations; bump to `error` once your tree is fully wrapped in `<T>`.

## Tips

- **Run on every commit.** Wire ESLint into `lint-staged` so dynamic keys and
  bare JSX literals never land in main.

- **Combine with [type-safety](type-safety.md).** `no-dynamic-key` guarantees
  the extractor can see every key; typegen guarantees every key the code
  references is actually in the catalog.

- **Custom marker components.** If you wrap `<T>` in a project-specific
  component (e.g. `<Translated>`), add it to `markers` so the rule doesn't flag
  its children.
