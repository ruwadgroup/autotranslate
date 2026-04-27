# Contributing to autotranslate

Thanks for considering a contribution! This guide gets you from zero to a merged
PR.

## Prerequisites

- **Node** ≥ 20 (see `.nvmrc` — `nvm use`)
- **pnpm** ≥ 10 (pinned via `packageManager` in `package.json`)
- **Git** with `core.autocrlf` off (LF is enforced via `.gitattributes`)

## Setup

```bash
git clone https://github.com/tamimbinhakim/autotranslate.git
cd autotranslate
pnpm install
pnpm build
```

## Working on a package

```bash
pnpm dev                                # watch every package
pnpm --filter @autotranslate/core dev   # watch one
pnpm --filter @autotranslate/core test  # test one
```

Examples are wired via `workspace:*`:

```bash
pnpm --filter @autotranslate/example-next-app dev
pnpm --filter @autotranslate/example-vite-react dev
```

## Code style

- **Formatter & linter** — [Biome](https://biomejs.dev/) for `.ts` / `.tsx` /
  `.json`. Prettier handles `.md` / `.yml` / `.yaml`.
- **TypeScript** — strict mode, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. No `any` without a `// biome-ignore`
  justification.
- **Imports** — `useImportType` is enforced. Type-only imports use
  `import type`.
- **Comments** — default to none. Add only when _why_ is non-obvious. No
  multi-paragraph docstrings.

```bash
pnpm lint           # check
pnpm lint:fix       # auto-fix
pnpm format         # format everything
pnpm typecheck      # full project tsc
```

## Tests

[Vitest](https://vitest.dev) across the monorepo. Place tests next to source
(`*.test.ts`) or under `tests/`.

```bash
pnpm test               # watch
pnpm test:ci            # one-shot
```

A PR that introduces new behavior includes tests.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced via the
`commit-msg` hook.

```
<type>(<scope>): <subject>

<body>

<footer>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

Allowed scopes: `core`, `cli`, `react`, `next`, `vite`, `providers`,
`eslint-plugin`, `mcp`, `examples`, `docs`, `ci`, `deps`, `release`.

Examples:

```
feat(react): add useT hook with ICU param inference
fix(cli): handle missing autotranslate.config.ts
docs: clarify provider auth flow
```

## Changesets

Any change to a published package needs a changeset.

```bash
pnpm changeset
```

Pick the affected packages, the bump (`patch` / `minor` / `major`), and write a
short summary aimed at end users. Commit the generated `.md`.

Skip changesets for: docs-only changes, internal refactors that don't touch
public API, CI / dev-tooling tweaks.

## Pull request flow

1. Fork & branch from `main`. Branch naming: `feat/<scope>/<short-desc>`,
   `fix/<scope>/<short-desc>`.
2. Make your change. Add tests. Add a changeset.
3. `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` — all green.
4. Open a PR against `main`. The template walks through the checklist.
5. CI runs lint, typecheck, tests on Node 20 + 22 across Linux / macOS /
   Windows.
6. A maintainer reviews. Approved → squash-merge.

## Releasing

Maintainers only. See [`.github/RELEASING.md`](.github/RELEASING.md).

## Reporting bugs / requesting features

Use the issue templates. Provide a minimal reproduction (StackBlitz or repo
link) — issues without one get closed.

## Security

Don't open a public issue for vulnerabilities. See [`SECURITY.md`](SECURITY.md).

## Code of conduct

By participating you agree to the [Contributor Covenant](CODE_OF_CONDUCT.md).
