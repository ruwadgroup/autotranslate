# Changesets

This directory holds [changesets](https://github.com/changesets/changesets) —
small, intent-based files that describe how versions should bump and what should
appear in the changelog.

## Adding a changeset

```bash
pnpm changeset
```

Pick the affected packages, the bump type (patch/minor/major), and write a short
summary. Commit the generated `.md` file alongside your code change.

## Releasing

A GitHub Action picks up changesets on `main` and opens a "Version Packages" PR.
Merging that PR triggers a publish to npm with
[provenance](https://docs.npmjs.com/generating-provenance-statements) via OIDC.

See [`.github/RELEASING.md`](../.github/RELEASING.md) for the full flow.
