# Contributing to autotranslate

Thanks for considering a contribution! This guide gets you from zero to merged
PR.

## Prerequisites

- **Node** ≥ 20 (see `.nvmrc` — use `nvm use`)
- **pnpm** ≥ 10 (this repo pins `packageManager` in `package.json`)
- **Git** with `core.autocrlf` off (we enforce LF via `.gitattributes`)

## Setup

```bash
git clone https://github.com/tamimbinhakim/autotranslate.git
cd autotranslate
pnpm install
pnpm build
```

## Working on a package

```bash
pnpm dev                          # watch every package
pnpm --filter @autotranslate/core dev   # watch one package
pnpm --filter @autotranslate/core test  # run that package's tests
```

Examples are wired to the workspace via `workspace:*`. Run them with:

```bash
pnpm --filter @autotranslate/example-next-app dev
pnpm --filter @autotranslate/example-vite-react dev
```

## Code style

- **Formatter & linter:** [Biome](https://biomejs.dev/) for
  `.ts`/`.tsx`/`.json`. Prettier handles `.md`/`.yml`/`.yaml`.
- **TypeScript:** strict mode, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. No `any` without a `// biome-ignore`
  justification.
- **Imports:** `useImportType` is enforced — type-only imports must use
  `import type`.
- **Comments:** default to none. Add only when _why_ is non-obvious. No
  multi-paragraph docstrings.

```bash
pnpm lint           # check
pnpm lint:fix       # auto-fix
pnpm format         # format everything
pnpm typecheck      # full project tsc
```

## Tests

Every package uses [Vitest](https://vitest.dev). Place tests next to source
(`*.test.ts`) or under `tests/`. Run:

```bash
pnpm test               # watch
pnpm test:ci            # one-shot, with coverage where configured
```

A PR introducing new behavior must include tests.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/).
`commit-msg` hook enforces this.

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
short summary aimed at end users. Commit the generated `.md` file. The release
workflow turns it into a GitHub release + npm publish.

Skip changesets for: docs-only changes, internal refactors that don't change
public API, CI/dev-tooling tweaks.

## Pull request flow

1. Fork & branch from `main`. Branch names: `feat/<scope>/<short-desc>`,
   `fix/<scope>/<short-desc>`.
2. Make your change. Add tests. Add a changeset.
3. `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` — all green.
4. Open a PR against `main`. The template walks through the checklist.
5. CI runs lint, typecheck, tests on Node 20 + 22 across Linux/macOS/Windows.
6. A maintainer reviews. Once approved, squash-merge.

## Releasing

Maintainers only. See [`docs/RELEASING.md`](docs/RELEASING.md).

## Reporting bugs / requesting features

Use the issue templates. Provide a minimal reproduction (StackBlitz or repo
link) — we close issues without one.

## Security

Don't open a public issue for vulnerabilities. See [`SECURITY.md`](SECURITY.md).

## Code of conduct

By participating you agree to the [Contributor Covenant](CODE_OF_CONDUCT.md).
