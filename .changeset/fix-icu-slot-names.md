---
'@autotranslate/react': patch
'@autotranslate/cli': patch
---

Auto-generated slot names for the formatter components (`<Num>`, `<Currency>`,
`<DateTime>`, `<RelativeTime>`) now use `_` as the index separator (`num_0`,
`currency_0`, …) instead of `#`. The previous form produced `{num#0}`
placeholders in the ICU representation, but `#` isn't a valid ICU argument-name
character so the round-trip through the AI provider (`treeToICU` → translate →
`icuToTree`) failed to parse on the way back. Pure runtime use never hit this —
only catalogs translated through an AI provider surfaced the bug.
