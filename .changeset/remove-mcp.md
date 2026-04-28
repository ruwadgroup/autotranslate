---
'@autotranslate/cli': patch
---

Remove `@autotranslate/mcp` from the workspace

The MCP package was a 0.0.2 stub that duplicated what the CLI + `agents.md`
already cover. Agents managing autotranslate (Claude Code, Cursor, Windsurf)
have shell access and a comprehensive single-file reference at
`node_modules/@autotranslate/cli/dist/agents.md` — wrapping the CLI in a
JSON-RPC layer added maintenance cost without unique capability.

The published `@autotranslate/mcp@0.0.2` stays accessible on npm but is no
longer maintained. Future agentic tooling will live inside the CLI as direct
subcommands or in adapter packages where appropriate.
