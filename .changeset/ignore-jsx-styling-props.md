---
'@autotranslate/cli': patch
---

Auto extraction now ignores semantic-looking object fields nested inside
explicit JSX styling props such as `classNames` and `styles`.
