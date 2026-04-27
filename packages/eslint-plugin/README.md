# @autotranslate/eslint-plugin

ESLint rules for autotranslate. Catches untranslated copy and broken keys at
write time, before the extractor runs.

```bash
pnpm add -D @autotranslate/eslint-plugin
```

## Quick features

- **`no-untranslated-jsx`** — flags bare JSX text and untranslated `title` /
  `aria-label` attributes.
- **`no-dynamic-key`** — keeps translator keys static so the extractor can see
  them. Accepts string-literal locals.
- **`valid-icu-format`** — parses every literal key as ICU and rejects malformed
  messages (mismatched braces, broken plural arms, stray apostrophes).
- **Flat + legacy.** Works with ESLint v9 flat config and the older `.eslintrc`
  format.

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

Flag user-visible string literals inside JSX that aren't wrapped in a
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
      // Extra attributes that may carry untranslated string literals.
      allowAttributes: ['placeholder'],
      // Extra components treated as translation markers.
      markers: ['MyTranslatedThing'],
    }],
  },
}
```

### `no-dynamic-key`

Translator calls (`t(...)` from `useT()` / `useTranslations()` / `getT()` /
`getTranslations()`) must use string-literal or template-literal-without-
expressions keys. Dynamic keys break extraction.

```js
const t = useT();
t('Sign out'); // ✅
t(`Sign out`); // ✅
t(KEY); // ✅ — KEY is a local string-literal const
t(`prefix.${id}`); // ❌ — dynamic key, can't be extracted
t(label); // ❌
```

### `valid-icu-format`

Parse ICU MessageFormat on every literal key passed to a translator. Catches
mismatched braces and malformed plural / select arms before runtime.

```js
t('Hello, {name}!'); // ✅
t('{count, plural, one {# item} other {# items}}'); // ✅
t('Hello, {name'); // ❌ unclosed
t('{count, plural, =0 {none}'); // ❌ malformed
```
