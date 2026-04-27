<div align="center">

# autotranslate

**Code-first, AI-powered i18n for any React framework.**

Write strings the way you write code. Run a command. Get translated catalogs.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg?logo=typescript&logoColor=white)](tsconfig.base.json)
[![Code style: Biome](https://img.shields.io/badge/code_style-biome-60a5fa.svg)](https://biomejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-f69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Conventional Commits](https://img.shields.io/badge/conventional_commits-1.0.0-fa6673.svg)](https://www.conventionalcommits.org)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#status)

</div>

> [!WARNING] autotranslate is pre-1.0. The API surface, package exports, and
> on-disk catalog format may change without notice until **v1.0.0**. See
> [`ROADMAP.md`](ROADMAP.md).

```tsx
<T>
  Welcome, <Var>{user.name}</Var>!
</T>
```

```bash
npx autotranslate translate
```

```
.translations/es.json, fr.json, ja.json …
```

## Quick features

- **Code is the source of truth.** Keys derive from your source — string
  literals for `useT`, structural hash for `<T>`. No JSON to hand-author.
- **Bring your own AI.** Vercel AI SDK (Anthropic, OpenAI, Google, OpenRouter)
  plus DeepL and Google Cloud Translation for short copy. Plug in anything via a
  custom provider.
- **Self-hosted by default.** Catalogs are JSON files in your repo. No cloud, no
  CDN, no vendor lock-in.
- **Framework-pluggable.** First-class adapters for Next.js, Vite, Remix, React
  Native, and edge runtimes (Vercel Edge, Cloudflare Workers, Bun).
- **End-to-end type-safe.** Codegen'd locale unions, narrowed `useT` keys, ICU
  param inference. A missing translation is a TypeScript error.
- **Edge-runtime friendly.** No `node:fs` in the runtime path. Synchronous
  translator, RSC-aware, edge-aware.
- **Fast diffs.** SHA-256 + per-(source, target, provider) cache means only
  changed strings hit the model.

## Documentation

Full documentation lives in [`docs/`](docs/):

- **[Getting Started](docs/getting-started.md)** — install, configure, and ship
  your first translated string.
- **[Guides](docs/guides/)** — `<T>`, `useT`, formatters, providers,
  type-safety.
- **[Frameworks](docs/frameworks/)** — Next.js, Vite, RSC, edge, React Native.
- **[CLI Reference](docs/cli.md)** — every command, every flag.
- **[Configuration](docs/configuration.md)** — `autotranslate.config.ts` schema.
- **[API Reference](docs/api-reference.md)** — typed exports per package.

## Installation

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
npx autotranslate init
```

## Quick start

Edit `autotranslate.config.ts`:

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: {
    name: 'ai',
    model: 'anthropic:claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

Wrap your app:

```tsx
import { T, TranslationProvider } from '@autotranslate/react';

export function App() {
  return (
    <TranslationProvider locale="en">
      <T>Hello, world!</T>
    </TranslationProvider>
  );
}
```

Translate:

```bash
npx autotranslate translate
```

The CLI extracts every `<T>` and `useT()` call, writes
`.translations/{locale}.json`, and only translates what changed. See the full
walkthrough in [Getting Started](docs/getting-started.md).

## How it works

```
Source code  →  AST extractor  →  en.json (canonical)
                                       │
                                       ▼
                         Diff vs cache (SHA-256)
                                       │
                                       ▼
                Translation provider (AI / DeepL / custom)
                                       │
                                       ▼
                  .translations/{locale}.json + .meta.json
                                       │
                                       ▼
        Runtime: load on demand (RSC) / bundle in (SPA / RN)
```

For the full design, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Why autotranslate?

| Library                | Code-as-source | AI translation | Self-hosted | Framework-pluggable |
| ---------------------- | :------------: | :------------: | :---------: | :-----------------: |
| `react-i18next`        |       ❌       |       ❌       |     ✅      |         ✅          |
| `next-intl`            |       ❌       |       ❌       |     ✅      |    Next.js only     |
| `lingui`               |       ✅       |       ❌       |     ✅      |         ✅          |
| `gt-next` / `gt-react` |       ✅       |       ✅       |     ❌      |   Next.js + React   |
| **`autotranslate`**    |       ✅       |       ✅       |     ✅      | ✅ + edge runtimes  |

## Examples

- [`examples/next-app`](examples/next-app) — Next.js App Router + RSC + proxy
- [`examples/vite-react`](examples/vite-react) — Vite + React SPA

```bash
pnpm --filter @autotranslate/example-next-app dev
pnpm --filter @autotranslate/example-vite-react dev
```

## Status

**Pre-alpha.** Implementations land package-by-package per the
[roadmap](ROADMAP.md).

| Phase    | Versions | What it means                                                   |
| -------- | -------- | --------------------------------------------------------------- |
| Pre-1.0  | `0.x.y`  | Active development. Breaking changes anytime. Treat as preview. |
| 1.0      | `1.0.0`  | First stable release. Public API frozen, semver from here on.   |
| Post-1.0 | `1.x.y+` | Backwards-compatible features and fixes per semver.             |

If you adopt a `0.x` build today, pin exact versions and read every changeset
before upgrading. Bug reports, design feedback, and PRs are welcome.

## Contributing

Run the dev workflow:

```bash
pnpm install
pnpm dev         # turbo run dev across all packages
pnpm test        # vitest across the monorepo
pnpm typecheck   # composite tsc
pnpm lint        # biome check
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full workflow and
[`.github/RELEASING.md`](.github/RELEASING.md) for the release process.

## License

MIT © [Tamim Bin Hakim](https://github.com/tamimbinhakim) and contributors.
