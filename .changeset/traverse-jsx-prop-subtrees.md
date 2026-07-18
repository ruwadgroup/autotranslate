---
'@autotranslate/cli': patch
'@autotranslate/core': patch
'@autotranslate/eslint-plugin': patch
---

Auto mode now traverses JSX embedded in JSX-valued props and spread expressions.
Composition APIs such as
`<ListPage actions={<Button><Icon /> Export</Button>} />` now wrap and extract
their rendered copy just like ordinary JSX children.

Semantic `header` fields are now classified as rendered interface copy, so table
column definitions are extracted and dynamic header expressions are translated
in auto mode.
