---
'@autotranslate/cli': patch
---

The extractor now resolves `const KEY = '...'; t(KEY)` and expressionless
template literals, matching what the `no-dynamic-key` lint rule already accepts
as static. Previously the lint rule blessed the pattern while the extractor
silently skipped it, so the string never reached the catalog.
