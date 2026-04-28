---
'@autotranslate/cli': minor
---

Ship `dist/agents.md` — a single-file, agent-readable reference for AI
assistants (Claude Code, Cursor, Windsurf, …). Mirrors Next.js's
`dist/docs/index.md` convention.

After installing `@autotranslate/cli`, agents reading the project's
`node_modules/` find the library's full surface (config, JSX/string translation,
standalone `t()`, providers, Zod, common patterns, gotchas, public API) at:

```
node_modules/@autotranslate/cli/dist/agents.md
```

`autotranslate init` now prints a hint with the path so users can paste it into
`AGENTS.md` / `CLAUDE.md` / `.cursorrules`.
