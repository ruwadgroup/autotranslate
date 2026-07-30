---
'@autotranslate/cli': minor
---

Add a git merge driver for the generated catalogs

Now that translation state is committed, two branches that both add copy will
both write to `.translations/`. Git's line-based merge conflicts on adjacent
keys and writes conflict markers into JSON, which breaks every consumer.

`autotranslate init` registers a merge driver and the matching `.gitattributes`
rules:

- **Catalogs** merge to the union of both sides' keys; deletions are honoured.
- **State** drops any key both branches retranslated, so the next `translate`
  re-derives that one key instead of picking an arbitrary winner.
- **`index.ts`** is regenerated from the union of both sides' chunk files, and
  now emits one import per line so it stays diff-friendly.

Conflicts in your own source still surface normally; only generated files
resolve automatically.

`.gitattributes` is committed, but the driver command lives in `.git/config`,
which git does not share. Teammates run `autotranslate init` once to enable it.

Also adds `autotranslate merge-driver <base> <ours> <theirs> [path]`, invoked by
git rather than by hand.
