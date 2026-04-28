# Overview

autotranslate is a code-first, AI-powered i18n toolkit for React. You write
strings inline. A CLI extracts them, runs them through a translation provider,
and writes JSON catalogs to your repo. The runtime swaps in the right copy at
render time.

## What you write

```tsx
<T>
  Hi, <Var>{user.name}</Var>! You have{' '}
  <Plural value={count} one="1 message" other="# messages" />.
</T>
```

```ts
const t = useT();
t('Sign out');
```

That's the whole authoring surface. No `t('marketing.hero.cta_v2')`, no JSON
files to hand-author, no key directories to organise.

## What the tool does

```
src/**/*.tsx                             ← code is the source of truth
   │
   ▼  autotranslate extract
.translations/en.json                    ← canonical source catalog
   │
   ▼  autotranslate translate
.translations/{es,fr,ja,…}.json          ← AI-translated targets
   │
   ▼  runtime
useT() / <T>                             ← active locale renders translated copy
```

You commit `.translations/` to your repo. Cache files track which keys hashed to
what, so a re-run only translates the strings you changed.

## Pillars

- **Code as the source of truth.** Keys are derived from your source — string
  literals for `useT`, structural hashes for `<T>`. Add or remove copy by
  editing components; the catalog follows.
- **Bring your own AI.** Vercel AI SDK (Anthropic, OpenAI, Google, OpenRouter)
  plus DeepL and Google Cloud Translation. Plug in anything via a custom
  provider.
- **Self-hosted.** Catalogs are JSON files in your repo. No cloud, no CDN, no
  vendor lock-in. Diff them in PRs, override them by hand, ship them through
  your own pipeline.
- **Framework-pluggable.** First-class adapters for Next.js, Vite, Remix, edge
  runtimes (Vercel Edge, Cloudflare Workers, Bun).
- **Type-safe.** Codegen'd locale unions, narrowed `useT` keys, ICU param
  inference. A missing translation is a TypeScript error.
- **Edge-runtime friendly.** No `node:fs` in the runtime path. Synchronous
  translator, RSC-aware, edge-aware.
- **Cheap re-runs.** SHA-256 + per-(source, target, provider) cache means only
  changed strings hit the model.

## How it compares

| Library                | Code-as-source | AI translation | Self-hosted | Framework-pluggable |
| ---------------------- | :------------: | :------------: | :---------: | :-----------------: |
| `react-i18next`        |       —        |       —        |      ✓      |          ✓          |
| `next-intl`            |       —        |       —        |      ✓      |    Next.js only     |
| `lingui`               |       ✓        |       —        |      ✓      |          ✓          |
| `gt-next` / `gt-react` |       ✓        |       ✓        |      —      |   Next.js + React   |
| **`autotranslate`**    |       ✓        |       ✓        |      ✓      |  ✓ + edge runtimes  |

## Status

Pre-1.0. The API surface, package exports, and on-disk catalog format may change
without notice until v1.0.0. See [`ROADMAP.md`](../ROADMAP.md).

If you're already using a `0.x` build, pin exact versions and read every
changeset before upgrading.

## Next

- [Installation](installation.md)
- [Quick start](quick-start.md)
- [Concepts](concepts.md)
