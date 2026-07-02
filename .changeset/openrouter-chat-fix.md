---
'@autotranslate/providers': patch
---

Fix the `openrouter` vendor: use the chat-completions endpoint (the bare OpenAI
factory returns a Responses-API model, which OpenRouter does not implement) and
pin the `@ai-sdk/*` peer ranges to `>=3 <4` with `ai >=6 <7` so pnpm's
auto-install-peers can no longer pair an incompatible spec-v4 SDK with the v6
runtime. Also removes the dead `./hybrid` subpath export.
