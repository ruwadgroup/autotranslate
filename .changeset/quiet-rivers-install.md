---
'@autotranslate/cli': patch
'@autotranslate/core': patch
'@autotranslate/eslint-plugin': patch
'@autotranslate/next': patch
'@autotranslate/providers': patch
'@autotranslate/react': patch
'@autotranslate/vite': patch
'@autotranslate/zod': patch
---

Fix package manifests so pnpm consumers receive installable versioned
dependencies instead of leaked workspace references. Render translated void HTML
elements such as `<br />` without invalid React children.
