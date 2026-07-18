---
'@autotranslate/core': patch
'@autotranslate/cli': patch
'@autotranslate/eslint-plugin': patch
---

Restrict auto-mode host-attribute translation to a positive set of visual and
accessibility copy attributes. Unknown HTML, SVG, ARIA, React, and library
attributes now remain structural by default, preventing values such as
`viewBox`, `role`, `aria-live`, SVG paint, file-accept filters, and numeric
geometry from entering translation catalogs or being rewritten at runtime.
