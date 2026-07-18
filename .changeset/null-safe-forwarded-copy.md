---
'@autotranslate/cli': patch
---

Make auto-mode translation of forwarded copy-bearing JSX attributes null-safe.
Generated code now translates only string values while preserving optional and
other non-string prop values unchanged.
