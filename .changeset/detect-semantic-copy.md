---
'@autotranslate/cli': patch
'@autotranslate/core': patch
'@autotranslate/eslint-plugin': patch
---

Detect catalog-backed interface copy carried through semantic component fields
such as `label`, `title`, and `description` in auto mode.

Extract static values for those fields, translate their dynamic JSX render
sites, and keep lint classification aligned while leaving unrelated dynamic data
untouched.
