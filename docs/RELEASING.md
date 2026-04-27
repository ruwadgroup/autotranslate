# Releasing

Maintainers only.

## Cadence

Releases cut as soon as a changeset lands on `main`. No fixed schedule.

## Flow

### 1. Author a changeset on the feature PR

```bash
pnpm changeset
```

Pick affected packages, bump type, and write a short user-visible summary.

### 2. Merge the PR to `main`

The release workflow (`.github/workflows/release.yml`) runs on every push to
`main`. It:

- Installs deps with the frozen lockfile.
- Builds every package via `turbo build`.
- Runs `changesets/action`. If pending changesets exist, it opens (or updates) a
  PR titled **"chore(release): version packages"** that bumps versions and
  rewrites changelogs.

### 3. Review the version PR

Verify the bumps match intent. Tweak per-package `CHANGELOG.md` entries as
needed.

### 4. Merge the version PR

The same workflow re-runs, sees no pending changesets, and instead **publishes**
to npm via:

```bash
pnpm release   # turbo run build --filter ./packages/* && changeset publish
```

Publishing uses the GitHub Actions OIDC token plus `NPM_TOKEN` for
[provenance](https://docs.npmjs.com/generating-provenance-statements). GitHub
Releases are created per published package.

## Required secrets / vars

- `NPM_TOKEN` — npm automation token with `publish` scope on `@autotranslate/*`
- `GITHUB_TOKEN` — auto-provided
- (optional) `TURBO_TOKEN` + `TURBO_TEAM` — remote turbo cache

## Verifying provenance

After publish, anyone can run:

```bash
npm audit signatures @autotranslate/core
```

to confirm the package was built from this repo at the recorded commit.

## Pre-releases

To cut a pre-release (e.g. `0.2.0-beta.0`):

```bash
pnpm changeset pre enter beta
# normal changeset flow
pnpm changeset pre exit
```

## Hotfixes

For an urgent fix on a stable release while `main` has unreleased work:

1. Branch from the published tag — `git checkout -b hotfix/<scope> <tag>`.
2. Apply the fix + changeset.
3. Open a PR against `release/<major>.<minor>`.
4. The release workflow on that branch publishes a patch.

## Yanking

Mistakes happen. Deprecate rather than unpublish:

```bash
npm deprecate @autotranslate/<pkg>@<version> "Reason"
```

Never run `npm unpublish` on a version older than 72 hours — it's blocked by
registry policy. Deprecate and ship a patch.
