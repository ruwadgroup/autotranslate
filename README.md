# autotranslate

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg?logo=typescript&logoColor=white)](tsconfig.base.json)
[![Code style: Biome](https://img.shields.io/badge/code_style-biome-60a5fa.svg)](https://biomejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-f69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Conventional Commits](https://img.shields.io/badge/conventional_commits-1.0.0-fa6673.svg)](https://www.conventionalcommits.org)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#project-status)

<!--
  CI / Release / npm badges activate once the repo + packages are published:
  ![CI](https://img.shields.io/github/actions/workflow/status/tamimbinhakim/autotranslate/ci.yml?branch=main&label=CI)
  ![npm](https://img.shields.io/npm/v/%40autotranslate%2Fcore?label=%40autotranslate%2Fcore)
-->

> [!WARNING]
>
> **autotranslate is in active development and is not yet feature-complete.**
>
> The API surface, package exports, and on-disk catalog format are all **subject
> to breaking changes without notice** until the **v1.0.0** release, which will
> mark the first **stable** version. Pre-1.0 versions (`0.x.y`) are pre-release
> builds — use them only if you are willing to follow along with breaking
> changes. See [`ROADMAP.md`](ROADMAP.md) for the path to stability.

> **Automated, AI-powered i18n for any React framework. Code is the source of
> truth.**

`autotranslate` is a TypeScript-first internationalization toolkit that scans
your codebase, extracts translatable strings, and translates them with the AI
model of your choice. No JSON hierarchies, no key bookkeeping, no proprietary
cloud — just write strings naturally and let the build pipeline handle the rest.

```tsx
// Write
<T>Welcome, <Var>{user.name}</Var></T>

// Run
npx autotranslate translate

// Get
.translations/es.json, fr.json, ja.json...
```

---

## Why another i18n library?

Existing solutions force a tradeoff:

| Library                | Code-as-source | AI translation | Self-hosted | Framework-pluggable |
| ---------------------- | :------------: | :------------: | :---------: | :-----------------: |
| `react-i18next`        |       ❌       |       ❌       |     ✅      |         ✅          |
| `next-intl`            |       ❌       |       ❌       |     ✅      |    Next.js only     |
| `lingui`               |       ✅       |       ❌       |     ✅      |         ✅          |
| `gt-next` / `gt-react` |       ✅       |       ✅       |     ❌      |   Next.js + React   |
| **`autotranslate`**    |       ✅       |       ✅       |     ✅      | ✅ + edge runtimes  |

`autotranslate` is the first toolkit to combine **strings-as-keys** +
**bring-your-own AI** + **fully self-hosted JSON catalogs** + **first-class
adapters for Next.js, Vite, Remix, React Native, and edge runtimes** +
**end-to-end typesafety** (codegen'd locale unions, typed message keys, ICU
param inference).

---

## Packages

This is a monorepo. Every package is published independently to npm under the
`@autotranslate/*` scope.

| Package                                                  | npm                            | Purpose                                                   |
| -------------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| [`@autotranslate/core`](packages/core)                   | `@autotranslate/core`          | Framework-agnostic runtime, types, ICU, locale resolution |
| [`@autotranslate/cli`](packages/cli)                     | `@autotranslate/cli`           | Extract, translate, watch, check                          |
| [`@autotranslate/react`](packages/react)                 | `@autotranslate/react`         | `<T>`, `useT`, `TranslationProvider`, RSC helpers         |
| [`@autotranslate/next`](packages/next)                   | `@autotranslate/next`          | Next.js plugin, middleware, server helpers                |
| [`@autotranslate/vite`](packages/vite)                   | `@autotranslate/vite`          | Vite plugin, virtual locale modules, HMR                  |
| [`@autotranslate/providers`](packages/providers)         | `@autotranslate/providers`     | Vercel AI SDK, DeepL, Google, custom                      |
| [`@autotranslate/eslint-plugin`](packages/eslint-plugin) | `@autotranslate/eslint-plugin` | Lint rules for translation hygiene                        |
| [`@autotranslate/mcp`](packages/mcp)                     | `@autotranslate/mcp`           | MCP server (Claude Code, Cursor, …)                       |

---

## Quick start

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
npx autotranslate init
```

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
import { TranslationProvider, T } from '@autotranslate/react';

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

That's it. The CLI extracts every `<T>` and `useT()` call, generates
`.translations/{locale}.json`, and translates only the diff.

---

## How it works

```
Source code  ──►  AST extractor  ──►  en.json (canonical)
                                          │
                                          ▼
                          Diff vs cache (SHA-256 + gzip)
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

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full design.

---

## Framework recipes

- **Next.js** → [`packages/next`](packages/next), example:
  [`examples/next-app`](examples/next-app)
- **Vite + React** → [`packages/vite`](packages/vite), example:
  [`examples/vite-react`](examples/vite-react)
- **Remix / React Router** → use `@autotranslate/react`
- **React Native** → use `@autotranslate/react` (no DOM peer)

---

## Repo layout

```
autotranslate/
├── packages/
│   ├── core/             # framework-free runtime + types
│   ├── cli/              # autotranslate command
│   ├── react/            # React + RSC bindings
│   ├── next/             # Next.js plugin & middleware
│   ├── vite/             # Vite plugin
│   ├── providers/        # AI / MT translation providers
│   ├── eslint-plugin/    # lint rules
│   └── mcp/              # MCP server
├── examples/
│   ├── next-app/         # Next.js App Router demo
│   └── vite-react/       # Vite + React demo
├── docs/
└── .github/              # CI, CodeQL, dependabot, templates
```

---

## Development

Requirements: Node ≥ 20, pnpm ≥ 10.

```bash
pnpm install
pnpm dev         # turbo run dev across all packages
pnpm build       # build all packages
pnpm test        # vitest across the monorepo
pnpm typecheck   # composite tsc
pnpm lint        # biome check
```

Conventional commits are enforced via commitlint + husky. Use `pnpm changeset`
to add a release note alongside any user-visible change.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full workflow.

---

## Project status

**Pre-alpha.** The repository scaffold is in place; implementations land
package-by-package per the [roadmap](ROADMAP.md).

| Phase    | Versions | What it means                                                                |
| -------- | -------- | ---------------------------------------------------------------------------- |
| Pre-1.0  | `0.x.y`  | Active development. **Breaking changes anytime.** Treat as preview.          |
| 1.0      | `1.0.0`  | **First stable release.** Public API frozen, semver guarantees from here on. |
| Post-1.0 | `1.x.y+` | Backwards-compatible features and fixes per semver.                          |

If you adopt a `0.x` build today, pin exact versions and read every changeset
before upgrading. Bug reports, design feedback, and PRs are very welcome.

---

## License

MIT © [Tamim Bin Hakim](https://github.com/tamimbinhakim) and contributors.
