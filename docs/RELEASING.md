# Releasing

Maintainers only.

## Cadence

We cut releases as soon as a changeset lands on `main`. There is no fixed
schedule.

## Flow

1. **Author a changeset on the feature PR.**

   ```bash
   pnpm changeset
   ```

   Pick affected packages, bump type, and write a short user-visible summary.

2. **Merge the PR to `main`.**

   The `release` workflow (`.github/workflows/release.yml`) runs on every push
   to `main`. It:
   - Installs deps with the frozen lockfile.
   - Builds every package via `turbo build`.
   - Runs `changesets/action`. If pending changesets exist, it opens (or
     updates) a PR titled **"chore(release): version packages"** that bumps
     versions and rewrites changelogs.

3. **Review the version PR.**

   Verify the bumps match intent. Tweak the changelogs if needed (the diff is in
   `CHANGELOG.md` per package).

4. **Merge the version PR.**

   The same workflow re-runs, sees no pending changesets, and instead
   **publishes** to npm via:

   ```bash
   pnpm release   # turbo run build --filter ./packages/* && changeset publish
   ```

   It uses GitHub Actions' OIDC token + `NPM_TOKEN` secret to publish with
   [provenance](https://docs.npmjs.com/generating-provenance-statements). After
   publish, GitHub Releases are created per published package.

## Required secrets / vars

- `NPM_TOKEN` — npm automation token with `publish` scope on `@autotranslate/*`.
- `GITHUB_TOKEN` — auto-provided.
- (optional) `TURBO_TOKEN` + `TURBO_TEAM` — remote turbo cache.

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
# when ready to leave pre-release:
pnpm changeset pre exit
```

## Hotfixes

For an urgent fix on a stable release while `main` has unreleased work:

1. Branch from the published tag: `git checkout -b hotfix/<scope> <tag>`.
2. Apply the fix + changeset.
3. Open a PR against a `release/<major>.<minor>` branch.
4. The release workflow on that branch will publish a patch.

## Yanking

Mistakes happen. To unpublish or deprecate:

```bash
npm deprecate @autotranslate/<pkg>@<version> "Reason"
```

Never run `npm unpublish` on a version older than 72 hours — it's blocked by
registry policy. Deprecate instead and ship a patch.
