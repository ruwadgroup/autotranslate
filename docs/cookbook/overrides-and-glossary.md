# Overrides & brand glossaries

Hand-curated copy that wins over machine translation. Two mechanisms, different
scopes.

## Overrides — per-locale, per-key

Defined in `autotranslate.config.ts`. Applied _after_ the provider runs.

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: { name: 'ai', model: 'anthropic:claude-haiku-4-5' },
  overrides: {
    fr: {
      'Sign out': 'Se déconnecter',
      'Welcome, {name}!': 'Bonjour, {name} !',
    },
    ja: {
      'Sign out': 'サインアウト',
    },
  },
});
```

**When to reach for it**: brand voice, idioms the AI gets wrong, regulatory
wording (terms of service phrasing), or copy a translator hand- delivered.

Overrides are part of your version-controlled config — they survive `pnpm i18n`
re-runs and are diffable in PRs.

## Inline overrides (one-off)

Edit `.translations/{locale}.json` directly. The CLI preserves manual edits
_until_ the source string changes:

```jsonc
// .translations/fr.json
{
  "Sign out": "Se déconnecter (édité à la main)",
}
```

When the source `Sign out` changes, the cached hash invalidates and the next
`translate` run replaces the manual edit. For _durable_ hand-edits, move them
into `overrides`.

## Brand glossary — protect specific terms

Some terms must never translate. Brand names, product names, technical
identifiers. Three approaches, in increasing power:

### 1. Wrap in a tag

```tsx
<T>
  Welcome to <span>autotranslate</span>!
</T>
```

The tag preserves the original text inside the translated tree. The translator
can move it but won't translate `autotranslate`.

### 2. Pass through `<Var>`

```tsx
<T>
  Powered by <Var name="brand">autotranslate</Var>.
</T>
```

`<Var>` content is opaque to the translator. Use this when the term should stay
untouched everywhere.

### 3. Provider `instruction` for tone & terms

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
},
instruction: `
  Brand: autotranslate. Never translate or transliterate the brand name.
  Voice: friendly, modern, direct. Keep sentences short.
  Glossary: "API", "SDK", "CLI" stay in English. "monorepo" stays.
`,
```

The instruction is included in the system prompt for every batch. It also
becomes part of the provider signature, so changing it invalidates the cache and
forces a re-translation — your call.

## Per-key descriptions

For ambiguous strings, attach a translator-facing comment:

```tsx
<T description="Action button on the cart screen — committing the purchase.">
  Submit
</T>
```

```ts
t('Submit', { $description: 'Account-settings save button' });
```

`description` doesn't change the key. It's stored in `.meta.json` and passed to
the AI as guidance.

## Disambiguating identical strings

Two `<T>Submit</T>` elsewhere in your app might mean different things. Use
`context`:

```tsx
<T context="cart action">Submit</T>
<T context="settings action">Submit</T>
```

Each gets its own catalog entry. Translators can use different verbs (`Pagar` vs
`Guardar` in Spanish).

## Tips

- **Overrides over manual edits.** Manual edits to JSON survive only until the
  source changes. Overrides survive forever.

- **Glossary in `instruction`, not in code.** Keeping brand terms in the
  provider config means they're applied uniformly — you don't have to remember
  to wrap every occurrence in `<Var>`.

- **Snapshot the cache after a translation pass.** If a model regression shows
  up later, you can roll back to the prior signature's cache.

- **Review overrides like code.** A PR that changes `overrides.fr['Sign out']`
  is a copy change worth reviewing.
