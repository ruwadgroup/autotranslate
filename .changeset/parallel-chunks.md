---
'@autotranslate/cli': minor
---

Per-chunk parallelism + streaming progress for `autotranslate translate`

`translate` now runs chunks across all targets in parallel up to
`config.concurrency` (default 8). With multiple locales and many chunks, this is
dramatically faster — chunks no longer block on one target finishing before
another starts.

`TranslateOptions` gains:

- `concurrency?: number` — override `config.concurrency` per call.
- `onProgress?: (event) => void` — fires on every chunk's `started` /
  `completed` transition with
  `{ target, chunkPath, status, fetched?, cached?, overridden? }`.

The CLI binary uses the new callback to render a live spinner — the user sees
`translating… 12 done, 8 in flight` while a translate runs instead of waiting
for everything to finish silently.
