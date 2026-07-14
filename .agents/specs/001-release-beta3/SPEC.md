---
id: 001
title: Harden and publish the feature-complete beta 3 release
slug: 001-release-beta3
status: done
tags: [area:release, area:packaging, type:fix, type:release]
priority: P0
severity: high
effort: L
risk:
  A malformed package or premature release could publish immutable broken
  artifacts to npm.
planned_at: { commit: 8ab2af6, date: 2026-07-14 }
depends_on: []
mockups:
  interface: null
  architecture: arch.md
research: null
---

# Spec 001: Harden and publish the feature-complete beta 3 release

> **Executor instructions**: This spec is portable - everything you need is in
> this file and the linked mockups. Follow it top to bottom. Run every command
> in the AI verification checklist and confirm the expected result before
> reporting done. If a STOP condition fires, stop and report - do not improvise.

## Problem

The public packages at commit `8ab2af6` contain all features listed as shipped
in `ROADMAP.md`, but npm still serves artifacts built from the April 29
`1.0.0-beta.2` release. The latest CLI fix and the zero-command product work are
therefore absent from npm. The release candidate also has concrete quality
failures: requiring the built ESLint plugin crashes because its CommonJS bundle
calls `createRequire(undefined)`, eight dual-format packages expose ESM
declarations ahead of their conditional CommonJS declarations, the Vite bundle
reports ambiguous CommonJS exports, Turbo reports missing Next.js build outputs,
npm reports pnpm-only `.npmrc` settings as unknown project configuration, pnpm
blocks unreviewed `esbuild` and `sharp` install scripts, and the production
audit reports vulnerable PostCSS through the Next.js example. Npm package
versions are immutable, so the corrected artifacts must ship as a new beta
release.

## Mockups

- **Interface** - `null` because this work has no visual product surface.
- **Architecture** - `arch.md` defines the fail-fast release gate from source
  verification through registry verification.

## Context (self-contained)

The workspace is a pnpm 10 and Turborepo monorepo with nine public packages
under `packages/` and two real example applications under `examples/`. The root
scripts in `package.json` define `lint`, `format:check`, `typecheck`, `test:ci`,
`build`, and `release`. The release workflow in `.github/workflows/release.yml`
uses Changesets and npm trusted publishing on pushes to `main`. The repository
is in Changesets pre-release mode with tag `beta`, and `pnpm changeset status`
resolves the pending release to `1.0.0-beta.3` for all packages except
`@autotranslate/typescript-plugin`, which resolves to its package-relative
`1.0.0-beta.2`. An existing release PR uses branch `changeset-release/main` and
must be refreshed after the fixes reach `main`. Generated `CHANGELOG.md` files
must never be edited manually.

The reproduced CommonJS failure is:

```text
node -e "require('./packages/eslint-plugin')"
TypeError [ERR_INVALID_ARG_VALUE]: The argument 'filename' ... Received undefined
```

The cause is `packages/eslint-plugin/src/index.ts:7`, which reads package
metadata with `createRequire(import.meta.url)` even though `import.meta` is
empty in CommonJS output. The Vite mixed-export warning originates from
`packages/vite/src/index.ts:12-13`, where the package exposes a default plugin
and a named constant while its extra Rollup treeshake pass rewrites CommonJS
output. The root export objects in the dual-format package manifests contain an
unconditional `types` condition before nested `import.types` and
`require.types`, so CommonJS consumers can resolve `.d.ts` instead of `.d.cts`.
Pnpm settings currently live in `.npmrc`, while pnpm's documented project
configuration home is `pnpm-workspace.yaml`; the workspace protocols already
make `prefer-workspace-packages` unnecessary. The production dependency audit
identifies PostCSS versions below `8.5.10` as vulnerable.

## Non-goals

Do not promote the packages from beta to the stable `latest` dist-tag. Do not
add features beyond the shipped roadmap or redesign public APIs unrelated to
release correctness. Do not merge unrelated Dependabot major-version upgrades.
Do not edit generated changelogs by hand. Do not publish directly from a
developer machine when the trusted GitHub Actions release flow is available.

## Instructions

1. Create an isolated `codex/` worktree from planned commit `8ab2af6` and
   implement all changes there.
2. Replace the ESLint plugin's runtime `createRequire(import.meta.url)` metadata
   lookup with a build-safe package version source, and add a regression check
   that loads the built package through CommonJS.
3. Remove unconditional `types` conditions from conditional export objects in
   every dual-format public package while preserving nested ESM `.d.ts`,
   CommonJS `.d.cts`, legacy top-level `types`, and `typesVersions`
   compatibility.
4. Make the TypeScript plugin explicitly CommonJS and mark side-effect-free
   packages accordingly.
5. Remove the redundant Vite Rollup treeshake pass so its mixed ESM/CommonJS
   build no longer warns, while preserving the documented default and named
   exports.
6. Add a repository-owned package verification command that runs Publint against
   every public package and performs ESM and CommonJS runtime smoke tests
   against built outputs.
7. Run the package verification command in CI after package builds and before
   release publication.
8. Move pnpm project settings out of `.npmrc`, explicitly allow only the
   reviewed `esbuild` and `sharp` dependency build scripts, remove settings that
   merely repeat pnpm defaults, and keep provenance configured in package
   manifests and CI.
9. Override vulnerable PostCSS to a patched compatible 8.x version, regenerate
   only the lockfile through pnpm, and confirm `pnpm audit --prod` reports no
   vulnerabilities.
10. Configure Turbo's Next.js example build outputs so a successful production
    build emits no missing-output warning.
11. Remove stale legacy wording that claims removed catalog fallbacks still
    exist, without removing intentional support for ESLint legacy configuration.
12. Add an appropriate Changeset covering every package whose published artifact
    or metadata changes.
13. Run the full automated checklist and inspect both example applications as
    production builds.
14. Commit the implementation without manually editing generated changelogs,
    merge it into `main`, push `main`, and wait for CI and the Changesets
    release PR to update.
15. Merge the green release PR so the trusted publishing workflow publishes the
    new beta artifacts.
16. Verify every expected version and `beta` dist-tag on npm, verify
    provenance/signatures where supported, and confirm the Git worktree is clean
    and synchronized.

## STOP conditions

Stop if the planned commit is no longer the base of the implementation worktree.
Stop if a required fix would change the stable `latest` dist-tag or force a GA
release. Stop if the trusted publishing workflow lacks required repository or
npm authorization after three verified attempts. Stop if the registry already
contains any target version with different contents, because npm versions are
immutable. Stop if an audit fix requires an incompatible major dependency
upgrade instead of a compatible override or patch.

## AI verification checklist (automatable)

- [ ] `pnpm install --frozen-lockfile` completes without unknown-config,
      blocked-build-script, or deprecation warnings.
- [ ] `pnpm lint` completes cleanly.
- [ ] `pnpm format:check` completes cleanly.
- [ ] `pnpm typecheck` completes with zero errors.
- [ ] `pnpm test:ci` passes all tests.
- [ ] `pnpm build` builds all packages and both real examples without warnings.
- [ ] `pnpm packages:check` reports no package-lint errors or warnings and loads
      supported ESM/CommonJS entries.
- [ ] `pnpm audit --prod` reports no known vulnerabilities.
- [ ] `pnpm changeset status` resolves the intended next beta versions.
- [ ] GitHub CI is green on Linux, macOS, and Windows for Node 20 and 22.
- [ ] The release workflow succeeds after the release PR merge.
- [ ] npm registry queries show the expected versions under the `beta` dist-tag
      with provenance.

## Human verification checklist (judgment calls)

- [ ] The zero-command development and frozen-build behavior matches the product
      promise.
- [ ] The breaking removals and release notes accurately describe the beta API
      surface.
- [ ] The Vite and Next example applications render and switch locales correctly
      in a browser.
- [ ] The published package names, versions, beta tags, and README content look
      correct on npm.
- [ ] The release is ready to remain a beta rather than being promoted to GA.
