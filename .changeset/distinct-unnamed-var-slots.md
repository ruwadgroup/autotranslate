---
'@autotranslate/core': patch
'@autotranslate/cli': patch
'@autotranslate/react': patch
---

Give every unnamed `<Var>` in a message its own slot. Two or more of them -
which is what auto mode emits for copy like `{label} - {price}` - all shared the
name `value`, so the whole message rendered the last one's value in every
position. Unnamed vars are now numbered in source order (`value`, `value2`,
`value3`) by both the extractor and the runtime; the first keeps the bare name,
so messages with a single var keep their existing catalog keys.
