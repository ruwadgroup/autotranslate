---
'@autotranslate/core': patch
'@autotranslate/cli': patch
'@autotranslate/react': patch
'@autotranslate/next': patch
'@autotranslate/vite': patch
'@autotranslate/providers': patch
'@autotranslate/eslint-plugin': patch
'@autotranslate/zod': patch
---

Fix subpath type resolution under legacy `moduleResolution`

Reported:
`Cannot find module '@autotranslate/core/config' or its corresponding type declarations.ts(2307)`
when consuming the package from a TypeScript project with
`moduleResolution: 'node10'` (the older default).

**Root cause.** Subpath exports (`@autotranslate/core/config`,
`@autotranslate/react/server`, etc.) declared their types via the `exports`
field only. Modern resolvers (`bundler` / `node16` / `nodenext`) read this
field; legacy `node10` does not, so the types were unresolvable on older
tsconfigs.

**Fixes applied to every public package:**

1. **Nest `types` per condition.** Each subpath now provides explicit
   `import.types` (→ `.d.ts`) and `require.types` (→ `.d.cts`) so consumers
   resolve the correct declaration shape for their module system.
2. **Add `typesVersions`** mapping each subpath to its `.d.ts` for legacy
   `node10` resolvers. This is the documented compat path.

After this release, all subpath imports resolve cleanly under `node10`,
`node16`, `nodenext`, and `bundler` resolution. Verified with
`@arethetypeswrong/cli`.

No runtime change. Patch-level bump.
