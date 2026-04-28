# Branded glossary

Keep your brand name, product names, and trademarked terms exactly right across
every translation. Three layers — pick the strongest you need; they compose.

## Layer 1 — `instruction` for global brand rules

Set a system-prompt-level instruction in your config. Every AI call sees it.

```ts
// autotranslate.config.ts
export default defineConfig({
  // …
  provider: {
    name: 'ai',
    model: 'anthropic:claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  instruction: `
Brand: autotranslate. Never translate the brand name; never transliterate.
Voice: friendly, modern, direct. Sentences short.
Glossary (always English): API, SDK, CLI, monorepo, runtime.
Glossary (always English in code-style copy): TypeScript, JavaScript, Node.js.
  `.trim(),
});
```

Trade-off: changes to `instruction` invalidate the provider cache (signature
changes), so the next translate run is a cold pass. Schedule for quiet PRs.

## Layer 2 — `<Var>` for opaque branded terms in UI

Wrap brand terms inside `<T>` with `<Var>` so the translator never sees them:

```tsx
import { T, Var } from '@autotranslate/react';

<T>
  Welcome to <Var name="brand">autotranslate</Var>! You're using{' '}
  <Var name="version">v0.8.0</Var>.
</T>;
```

The translator sees `Welcome to {brand}! You're using {version}.` — neither
value can be translated, accidentally re-cased, or transliterated. Best for
terms that need to render at runtime as a literal string.

## Layer 3 — `overrides` for exact per-locale phrasings

When the AI gets a specific term wrong in a specific locale, lock it manually:

```ts
overrides: {
  fr: {
    'Sign in to autotranslate': 'Se connecter à autotranslate',
    // legal copy that needs exact phrasing
    'By continuing, you agree to our Terms.':
      'En continuant, vous acceptez nos Conditions d\'utilisation.',
  },
  ja: {
    'Sign in to autotranslate': 'autotranslate にサインイン',
  },
}
```

Overrides apply **after** machine translation, so the AI's output is discarded
for these specific keys per locale. Other locales still get the AI translation.

## Layer 4 — separate config for terminology-heavy content

For docs sites, marketing copy, or legal text where terminology accuracy matters
most, run a second `autotranslate` config with a tighter `instruction` and
lower-temperature model:

```ts
// autotranslate.legal.config.ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/legal/**/*.{ts,tsx}'],
  outDir: '.translations.legal',
  provider: {
    name: 'ai',
    model: 'anthropic:claude-sonnet-4-5', // bigger model for nuance
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  instruction: `
You are translating legal copy. Preserve the exact meaning and structure.
Use the formal register appropriate for legal documents in the target
language. Never paraphrase. Never simplify. If a term has a legally-precise
translation in the target jurisdiction, use it.
  `.trim(),
});
```

Run both pipelines:
`pnpm i18n && pnpm autotranslate -c autotranslate.legal.config.ts translate`.

## Glossary as a runtime-loaded reference

For a glossary that translators (human or AI) can reference but not modify, ship
a glossary file that lives outside the catalog:

```ts
// src/i18n/glossary.ts — extracted into the source catalog as references
import { t } from '@autotranslate/core/t';

export const glossary = {
  brand: t('autotranslate'),
  edition: t('Pro Edition'),
  // …
};
```

These flow through `autotranslate extract` like any other `t()` call. Use them
via `<Var>{glossary.brand}</Var>` to lock the phrasing.

## Pseudo-locale audit

Before shipping a glossary, run a pseudo translate to surface anything that
wasn't wrapped:

```ts
provider: { name: 'stub', pseudo: true }
```

Run `autotranslate translate`. Anything that comes through plain English is a
candidate to wrap in `<Var>` or add to the glossary.

## Tips

- **Test the instruction prompt.** Send 10 representative strings through the AI
  provider with your `instruction` and read the output. Iterate before running a
  full translate.
- **Per-vendor preferences**. `claude-haiku-4-5` follows brand-name rules more
  reliably than `gpt-4o-mini` in our testing. If a specific term keeps breaking
  in one locale, try a different model for that batch.
- **Document the glossary in your repo**. Even if it's all in `instruction`,
  mirror it in `docs/translation-glossary.md` so future contributors don't
  accidentally undo brand rules with a config edit.
- **Diff overrides on every PR**. Translation overrides are content changes —
  review them like any other copy update.
