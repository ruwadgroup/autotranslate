---
'@autotranslate/cli': patch
'@autotranslate/core': patch
'@autotranslate/eslint-plugin': patch
'@autotranslate/next': patch
'@autotranslate/providers': patch
'@autotranslate/react': patch
'@autotranslate/typescript-plugin': patch
'@autotranslate/vite': patch
'@autotranslate/zod': patch
---

Harden package metadata and release verification for ESM and CommonJS consumers.
Conditional exports now resolve `.d.ts` declarations for ESM and `.d.cts`
declarations for CommonJS without an ambiguous outer `types` condition. The
ESLint plugin no longer crashes when loaded through `require()`. Every release
now passes strict package linting and runtime entry-point smoke tests before
publication. Vite auto mode now transforms JSX before framework plugins compile
it, so plain JSX is translated regardless of plugin order.
