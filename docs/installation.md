# Installation

## Requirements

- Node.js ≥ 20
- Any package manager — `pnpm`, `npm`, `yarn`, `bun`

## Core install

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
```

`@autotranslate/cli` only runs when you extract or translate — keep it as a dev
dependency. The runtime packages stay in your production bundle.

## Framework adapters

Pick the one that matches your setup. Install alongside the core packages above.

### Next.js (App Router, Pages Router, RSC, Edge)

```bash
pnpm add @autotranslate/next
```

### Vite (SPA, SSR via Vike, Astro)

```bash
pnpm add -D @autotranslate/vite
```

### Remix / React Router 7+

No dedicated package — Remix loaders + actions consume `@autotranslate/react`
directly. See the [Remix guide](frameworks/remix.md).

### React Native, Expo

`@autotranslate/react` works inline. Catalog loading is bundler-specific — see
[Lazy-loading large catalogs](cookbook/lazy-loading.md) for patterns.

## Optional packages

| Package                        | Use it for                                            |
| ------------------------------ | ----------------------------------------------------- |
| `@autotranslate/providers`     | Wired automatically when you set `provider` in config |
| `@autotranslate/zod`           | Translated Zod validation errors                      |
| `@autotranslate/eslint-plugin` | Catches untranslated JSX and dynamic keys             |

```bash
pnpm add @autotranslate/zod
pnpm add -D @autotranslate/eslint-plugin
```

## AI provider peer deps

The `ai` provider lazy-loads vendor SDKs. Install only what you use.

| Vendor       | Peer dep            |
| ------------ | ------------------- |
| `anthropic`  | `@ai-sdk/anthropic` |
| `openai`     | `@ai-sdk/openai`    |
| `google`     | `@ai-sdk/google`    |
| `openrouter` | `@ai-sdk/openai`    |

```bash
pnpm add @ai-sdk/anthropic   # plus `ai` is required
pnpm add ai
```

## Initialise

```bash
npx autotranslate init
```

Writes `autotranslate.config.ts` to your project root. Edit `targets`,
`content`, and `provider` for your project — see the
[Configuration reference](reference/configuration.md).

## Next

- [Quick start](quick-start.md) — translate your first string
- [Concepts](concepts.md) — how the pieces fit
