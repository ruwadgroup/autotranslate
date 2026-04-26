---
'@autotranslate/cli': patch
---

Fix JSX-text whitespace normalization in the extractor to match React's JSX
runtime. Previously, `<T>...<Marker/>\n  .\n</T>` extracted as `' . '` (with
surrounding spaces), but at runtime React renders just `.` — canonical keys
mismatched and translations weren't applied. The extractor now mirrors
`@babel/types`'s `cleanJSXElementLiteralChild`: whitespace-only lines drop,
leading whitespace on continuation lines trims, trailing whitespace on non-final
lines trims, and lines join with single spaces. Multi-space within a line is
preserved (matches React's behavior).
