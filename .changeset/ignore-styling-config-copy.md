---
'@autotranslate/cli': patch
---

Auto extraction now ignores semantic-looking slot fields nested inside
statically imported `tailwind-variants` and `class-variance-authority` styling
factory calls. Real configuration labels and table headers remain extractable.
