---
'@autotranslate/core': minor
'@autotranslate/cli': minor
'@autotranslate/providers': minor
---

Add the `agent` provider - translate with Claude Code or Codex

Drives a headless coding-agent CLI already installed and signed in on the
machine, instead of calling a model API. No API key, no separate billing.

```ts
provider: {
  name: 'agent',
  agent: 'claude',            // or 'codex'
  model: 'claude-haiku-4-5',  // optional
}
```

The agent is used strictly as a text transformer - tools disabled, sandbox
read-only, prompt on stdin, JSON out. It cannot touch your repository.

- **Claude Code**: `claude -p --output-format json --disallowedTools '*'`.
  Fenced or prose-wrapped answers are unwrapped by a balanced-brace scan.
- **Codex**: `codex exec --sandbox read-only --output-schema`, so the response
  shape is enforced by the API rather than by prompt discipline.

Options: `agent`, `model`, `command`, `args`, `timeoutMs` (default 300000).

Each batch is a process spawn, so this suits local development and
small-to-medium catalogs rather than bulk runs; keep `concurrency` modest. CI
runners do not carry your agent login, so prefer `ai` with a key there.

Batching, retry with backoff, and re-asking for omitted keys are shared with the
`ai` provider.
