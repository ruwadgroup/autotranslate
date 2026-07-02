# CI / CD pipelines

The core insight: **build IS the check**. `withAutotranslate` and
`@autotranslate/vite` run `checkFrozen` on every production build. If any source
string is not committed to `.translations/`, the build fails with a precise
list. CI needs no API key — the model is never called at build time.

## How it works

When the framework plugin runs a production build it:

1. Re-extracts source strings in memory
2. Compares against the committed catalog
3. Fails with a clear message if anything is uncommitted:

```
Catalog is out of date.

2 source strings not committed to .translations:
  - 'Check out' (components/Cart.tsx:41)
  - 'Empty cart' (components/Cart.tsx:58)

Run your dev server or `autotranslate translate`, then commit .translations/
```

No secrets required. No i18n step in CI. The developer translates locally (via
the dev loop or `autotranslate translate`) and commits `.translations/` with the
source change.

## Minimal CI workflow

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build # frozen check runs here - no ANTHROPIC_API_KEY needed
```

The `pnpm build` call hits `withAutotranslate` (or `@autotranslate/vite`'s
`buildStart`), which calls `checkFrozen`. If the catalog is complete, the build
proceeds and the model is never contacted. If anything is missing, the build
fails with the exact strings and file locations.

## PR parity report

The frozen check tells you what's wrong at build time. For PR review,
`autotranslate parity` gives reviewers a readable table of what changed in the
catalog:

```bash
npx autotranslate parity --base origin/main --format github
```

See [PR parity](pr-parity.md) for the full GitHub Actions workflow.

## Caching the provider cost

When a developer runs `autotranslate translate` locally, the per-chunk cache
lives in `.translations/.cache/`. Cache the `.cache/` directory across CI runs
when you do occasional bulk retranslations:

```yaml
- name: Cache translation cache
  uses: actions/cache@v4
  with:
    path: .translations/.cache
    key: i18n-${{ hashFiles('src/**/*.{ts,tsx}', 'autotranslate.config.ts') }}
    restore-keys: |
      i18n-
```

A PR with no source-string changes hits zero model calls.

## Escape hatch: translateOnBuild

If you want the build to translate instead of fail (e.g. a monorepo where
catalog commits are impractical), set:

```ts
// autotranslate.config.ts
export default defineConfig({
  // ...
  build: {
    frozen: true,
    translateOnBuild: true, // translate missing strings, then re-check
  },
});
```

With `translateOnBuild: true`, the build calls `translate` when `checkFrozen`
fails, then re-checks. If the re-check passes, the build continues — but an API
key must be available as an environment variable.

```yaml
# Only needed with translateOnBuild: true
- run: pnpm build
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Every build burns tokens this way. The default
(`frozen: true, translateOnBuild: false`) is recommended for most teams.

## Disabling the frozen check

To opt out entirely (useful during initial migration or for a library that ships
without catalogs):

```ts
export default defineConfig({
  // …
  build: { frozen: false },
});
```

The build proceeds regardless of catalog completeness.

## Tips

- **Fresh projects pass automatically.** When `.translations/<source>/` does not
  exist on disk, `checkFrozen` returns `{ ok: true, catalogAbsent: true }` so
  example projects and first-run CI never fail.
- **Commit `.translations/` except `.cache/`.** `init` already gitignores
  `.translations/.cache/`; commit everything else.
- **Switch providers carefully.** Changing the provider signature (model name or
  vendor) invalidates the per-chunk cache and re-translates everything on the
  next `translate` run.
- **Combine with `autotranslate check` for scripted verification.** The CLI
  `check` command verifies parity (missing/orphan/invalid-ICU) without the
  source-extraction comparison that `checkFrozen` adds.
