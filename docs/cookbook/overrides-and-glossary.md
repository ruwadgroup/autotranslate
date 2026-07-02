# Overrides & brand glossaries

Lock specific strings in specific locales against AI translation errors. Read
the [philosophy doc](../philosophy.md) first - overrides are an **escape
hatch**, not the primary surface. Reach for `instruction` and `glossary` before
you reach for `overrides`.

## When overrides are the right answer

Use overrides when the AI got something definitively wrong in one specific
locale and no upstream guidance fixes it cheaply. A French legal phrase that has
to read exactly one way. A trademark whose Japanese rendering must match the
registered form character-by-character.

Try first:

1. Add the term to **`glossary`** if it's something that must never translate.
2. Tighten **`instruction`** with a one-line rule about tone, brand, or
   terminology.
3. Wrap a **`<Var>`** around the specific span if it's a literal you want to
   inject untouched.
4. Adjust the **source string** to remove ambiguity (often the cheapest fix).

If the AI still gets it wrong, lock the answer in `overrides`. A codebase whose
`overrides` file runs hundreds of lines is one whose prompt isn't doing enough
work - revisit.

## Overrides - per-locale, per-key

Defined in `autotranslate.config.ts`. Applied after the provider runs.

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
specific idioms the model keeps producing wrong. Not for routine copy edits -
those belong upstream in source, instruction, or glossary.

Overrides are part of your version-controlled config - they survive translate
re-runs and are diffable in PRs.

> **Don't edit `.translations/<locale>/<chunk>.json` files by hand.** That
> directory is a build artefact. The next translate run is allowed to rewrite
> it. Hand-edits are not durable. If a value needs to be locked across runs, put
> it in `overrides`.

## Brand glossary - protect specific terms

Some terms must never translate: brand names, product names, technical
identifiers. Four approaches, in increasing power:

### 1. The `glossary` config field

```ts
// autotranslate.config.ts
export default defineConfig({
  // ...
  glossary: ['autotranslate', 'Edge Config', 'Pro Edition'],
});
```

Every term listed here is preserved exactly - the CLI prepends a "never
translate or transliterate these terms" preamble to every AI call. This is the
first thing to reach for: one line, applied uniformly, no code changes.

### 2. Wrap in a tag

```tsx
<T>
  Welcome to <span>autotranslate</span>!
</T>
```

The tag preserves the original text inside the translated tree. The translator
can move it but won't translate `autotranslate`.

### 3. Pass through `<Var>`

```tsx
<T>
  Powered by <Var name="brand">autotranslate</Var>.
</T>
```

`<Var>` content is opaque to the translator. Use this when the term should stay
untouched everywhere.

### 4. `instruction` for tone and voice rules

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
},
glossary: ['API', 'SDK', 'CLI', 'monorepo'],
instruction: `
  Voice: friendly, modern, direct. Keep sentences short.
  Address the user informally where the language allows it.
`,
```

The instruction is included in the system prompt for every batch; the `glossary`
terms are prepended to it as a preserve-exactly list. Changing either
invalidates the cache and forces a re-translation on the next run.

## Separate config for terminology-heavy content

For docs sites, marketing copy, or legal text where terminology accuracy matters
most, run a second `autotranslate` config with a tighter `instruction` and a
bigger model. Place the config in its own directory so `loadConfig` can find it.
`content` globs and `outDir` resolve relative to the config's directory:

```ts
// content/legal/autotranslate.config.ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['**/*.{ts,tsx}'], // relative to content/legal/
  outDir: '.translations', // lands at content/legal/.translations/
  provider: {
    name: 'ai',
    model: 'anthropic:claude-sonnet-4-5', // bigger model for nuance
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  instruction: `
You are translating legal copy. Preserve the exact meaning and structure.
Use the formal register appropriate for legal documents in the target language.
Never paraphrase. Never simplify. If a term has a legally-precise translation
in the target jurisdiction, use it.
  `.trim(),
});
```

Create a script that loads and runs each config:

```ts
// scripts/translate-all.ts
import { loadConfig, translate } from '@autotranslate/cli';

// Main catalog
await translate(await loadConfig('.'));

// Legal / terminology-heavy catalog
await translate(await loadConfig('content/legal'));
```

Run both pipelines:

```bash
npx autotranslate translate          # main catalog
npx tsx scripts/translate-all.ts    # all configs in sequence
```

## Pseudo-locale audit

Before shipping a glossary, run a pseudo translate to surface anything not
wrapped:

```ts
provider: { name: 'stub', pseudo: true }
```

Run `npx autotranslate translate`. Anything that comes through as plain English
is a candidate to wrap in `<Var>` or add to the glossary.

## Per-key descriptions

For ambiguous strings, attach a translator-facing comment:

```tsx
<T description="Action button on the cart screen - committing the purchase.">
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

- **Glossary in config, not in code.** Keeping brand terms in the `glossary`
  field means they're applied uniformly - you don't have to remember to wrap
  every occurrence in `<Var>`.

- **Test the instruction prompt.** Send 10 representative strings through the AI
  provider with your `instruction` and read the output. Iterate before running a
  full translate.

- **Snapshot the cache after a translation pass.** If a model regression shows
  up later, you can roll back to the prior signature's cache.

- **Review overrides like code.** A PR that changes `overrides.fr['Sign out']`
  is a copy change worth reviewing.

- **Diff overrides on every PR.** Translation overrides are content changes -
  review them like any other copy update.
