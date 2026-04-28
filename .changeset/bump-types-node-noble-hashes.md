---
'@autotranslate/core': patch
---

Bump `@noble/hashes` to v2.2 and `@types/node` to v25 across the workspace.

`@noble/hashes` v2 requires `.js` extensions in import paths and dropped
string-input support; `core/src/hash.ts` now imports from
`@noble/hashes/sha2.js` and `@noble/hashes/utils.js` and wraps the input through
`utf8ToBytes` before hashing.
