# CI / CD pipelines

Two policies. Pick one based on whether you commit `.translations/` to your
repo.

## Policy A — Translate in CI, commit catalogs

The default. CI runs `extract` + `translate` on every PR; the catalogs are
committed with the source change.

```yaml
# .github/workflows/i18n.yml
name: i18n

on:
  pull_request:
    paths:
      - 'src/**'
      - 'autotranslate.config.ts'
      - 'package.json'

jobs:
  i18n:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Run autotranslate
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: pnpm i18n

      - name: Verify catalog parity
        run: npx autotranslate check

      - name: Commit catalogs
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore(i18n): update translations'
          file_pattern: '.translations/**'
```

```jsonc
// package.json
{
  "scripts": {
    "i18n": "autotranslate extract && autotranslate translate && autotranslate generate-types",
  },
}
```

Pros:

- Reviewers see translation diffs in PRs.
- Production builds don't hit the model.
- `.translations/` is the auditable source of truth.

## Policy B — Translate at build time, don't commit

Catalogs are regenerated on every build. Treat `.translations/` as a build
artefact.

```jsonc
// .gitignore
.translations/
```

```jsonc
// package.json
{
  "scripts": {
    "build": "pnpm i18n && next build",
  },
}
```

Pros:

- No noisy catalog diffs.
- Always matches the source the model saw.

Cons:

- Every build burns tokens.
- Reviewers can't see translation changes.
- AI provider has to be available at build time.

## Drift check (Policy A only)

Catch developers who forgot to run `pnpm i18n`:

```yaml
- name: Check catalogs are up to date
  run: |
    pnpm i18n
    if [ -n "$(git status --porcelain .translations/)" ]; then
      echo "::error::.translations/ is out of date. Run pnpm i18n locally."
      git diff .translations/
      exit 1
    fi
```

Wire this into the PR workflow. Fails fast, surfaces the diff.

## Caching the provider cost

`autotranslate translate` already caches per-(source, target, provider) locally
in `.translations/.cache/`. Cache that across CI runs:

```yaml
- name: Cache translation cache
  uses: actions/cache@v4
  with:
    path: .translations/.cache
    key: i18n-${{ hashFiles('src/**/*.{ts,tsx}', 'autotranslate.config.ts') }}
    restore-keys: |
      i18n-
```

A no-op PR (no source-string changes) hits zero model calls.

## Required secrets

| Provider         | Secret name                    |
| ---------------- | ------------------------------ |
| `anthropic`      | `ANTHROPIC_API_KEY`            |
| `openai`         | `OPENAI_API_KEY`               |
| `google` (AI)    | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `openrouter`     | `OPENROUTER_API_KEY`           |
| `deepl`          | `DEEPL_API_KEY`                |
| `google` (Cloud) | `GOOGLE_API_KEY`               |

Set them at the repo (or org) level in GitHub settings. The CLI reads them from
`process.env` automatically when the provider's `apiKey` field references them
via `process.env.X`.

## Verifying in PR — `autotranslate check`

Run unconditionally on every PR:

```yaml
- run: npx autotranslate check
```

Catches:

- Missing keys (some target locale didn't translate this entry)
- Orphan keys (entry no longer referenced in source)
- Invalid ICU (malformed plural / select arms)

Exits non-zero. Block merges on it.

## Tips

- **Cache invalidates per provider signature.** Switching models
  (`anthropic:claude-haiku-4-5` → `anthropic:claude-sonnet-4-5`) re- translates
  everything. Schedule that change for a quiet PR.

- **Don't run `i18n` from a draft PR.** Add
  `if: github.event.pull_request.draft == false` to skip while drafts churn.

- **Bot the commit.** Use a deploy key or a fine-grained PAT, not your personal
  token, to push catalog updates back to the PR.

- **Combine with `lint-staged`.** `pnpm i18n` on pre-commit is fast (cache hit)
  and prevents stale catalogs from landing in main.
