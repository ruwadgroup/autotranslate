---
'@autotranslate/cli': patch
'@autotranslate/react': patch
'@autotranslate/next': patch
'@autotranslate/vite': patch
---

Preserve custom JSX component names in auto mode so compound messages containing
components such as Next.js `Link` resolve their structured catalog entries at
runtime.

Remove the internal tag hint before cloning the original component so it does
not leak into rendered DOM attributes.
