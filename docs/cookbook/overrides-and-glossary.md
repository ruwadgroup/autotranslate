# Overrides & brand glossaries

Locking specific strings in specific locales. Read the
[philosophy doc](../philosophy.md) first — overrides are an **escape hatch**,
not the primary surface. Reach for `instruction` and `glossary` before you reach
for `overrides`.

## When overrides are the right answer

When the AI got something definitively wrong in one specific locale and no
upstream guidance fixes it cheaply. A French legal phrase that has to read
exactly one way. A trademark whose Japanese rendering must match the registered
form character-by-character.

Try first:

1. Add the term to **`glossary`** if it's something that must never translate.
2. Tighten **`instruction`** with a one-line rule about tone, brand, or
   terminology.
3. Wrap a **`<Var>`** around the specific span if it's a literal you want to
   inject untouched.
4. Adjust the **source string** to remove ambiguity (often the cheapest fix).

If the AI still gets it wrong, lock the answer in `overrides`. A codebase whose
`overrides` file runs hundreds of lines is one whose prompt isn't doing enough
work — revisit.

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

**Use it for**: trademark phrasings, regulated wording (terms of service),
specific idioms the model keeps producing wrong. Not for routine copy edits —
those belong upstream in source / instruction / glossary.

Overrides are part of your version-controlled config — they survive `pnpm i18n`
re-runs and are diffable in PRs.

> **Don't edit `.translations/{locale}.json` files by hand.** That directory is
> a build artefact. The next translate run is allowed to rewrite it. Hand-edits
> are not durable. If a value needs to be locked across runs, put it in
> `overrides`.

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
