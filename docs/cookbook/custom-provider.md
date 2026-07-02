# Custom translation provider

Plug in your own translation service - local LLMs, internal APIs, glossary-aware
pipelines, or hybrid setups. A provider is a small async function that receives
a batch of strings and returns their translations.

## Minimal shape

```ts
import { defineProvider } from '@autotranslate/providers';

export const myProvider = defineProvider({
  name: 'my-service',
  signature: 'my-service:v1',
  async translate({ source, target, items, instruction, signal }) {
    const response = await fetch('https://my-service.example.com/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source, target, items, instruction }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`my-service responded ${response.status}`);
    }
    const json = (await response.json()) as {
      translations: Record<string, string>;
    };
    return { translations: json.translations };
  },
});
```

`signature` is part of the cache key. Bump it whenever the provider's behaviour
changes (model swap, prompt rewrite) so stale entries invalidate.

## Wire it in

```ts
// autotranslate.config.ts
export default defineConfig({
  // ...
  provider: { name: 'custom' },
});
```

```ts
// scripts/translate.ts
import { loadConfig, translate } from '@autotranslate/cli';
import { myProvider } from './my-provider';

const resolved = await loadConfig();
await translate(resolved, { provider: myProvider });
```

The CLI binary throws if it sees `name: 'custom'` without a provider override -
custom providers are functions and don't survive JSON serialisation. The same
applies to the dev loop: with `name: 'custom'` the framework plugin can't
auto-translate on save, so run your script (`npx tsx scripts/translate.ts`)
after adding strings.

## Hybrid: AI for trees, DeepL for plain strings

The `ai` provider handles structured trees with placeholders, plurals, and tag
wrappers well. DeepL is better (and cheaper) for plain UI labels. Hand-roll the
split with a custom provider:

```ts
import { isStructured } from '@autotranslate/core';
import { defineProvider } from '@autotranslate/providers';
import { createAIProvider } from '@autotranslate/providers/ai';
import { createDeepLProvider } from '@autotranslate/providers/deepl';

const ai = createAIProvider({ model: 'anthropic:claude-haiku-4-5' });
const deepl = createDeepLProvider({ apiKey: process.env.DEEPL_API_KEY! });

export const hybridProvider = defineProvider({
  name: 'ai-deepl',
  signature: `ai-deepl:${ai.signature}+${deepl.signature}`,
  async translate(request) {
    const structured = request.items.filter((i) => isStructured(i.source));
    const plain = request.items.filter((i) => !isStructured(i.source));
    const [a, b] = await Promise.all([
      ai.translate({ ...request, items: structured }),
      deepl.translate({ ...request, items: plain }),
    ]);
    return { translations: { ...a.translations, ...b.translations } };
  },
});
```

Plain strings cost a fraction of what the AI charges per token. Trees stay on AI
for ICU correctness.

## Glossary-aware: pre-process source

Lock specific terms to specific translations before the model sees them:

```ts
const GLOSSARY: Record<string, string> = {
  Vercel: 'Vercel', // never translate
  'Edge Config': 'Edge Config',
  autotranslate: 'autotranslate',
};

export const glossaryAware = defineProvider({
  name: 'ai-glossary',
  signature: `ai-glossary:v1:${ai.signature}`,
  async translate(request) {
    // Pre-process: replace glossary terms with sentinels
    const sentinel = (n: number) => `[[GLOS:${n}]]`;
    const reverse = new Map<string, string>();
    let i = 0;
    const items = request.items.map((item) => {
      if (typeof item.source !== 'string') return item;
      let text = item.source;
      for (const [from] of Object.entries(GLOSSARY)) {
        if (text.includes(from)) {
          const tag = sentinel(i++);
          reverse.set(tag, from);
          text = text.split(from).join(tag);
        }
      }
      return { ...item, source: text };
    });

    const result = await ai.translate({ ...request, items });

    // Post-process: restore sentinels
    const translations: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.translations)) {
      if (typeof value !== 'string') {
        translations[key] = value;
        continue;
      }
      let restored = value;
      for (const [tag, original] of reverse) {
        restored = restored.split(tag).join(GLOSSARY[original] ?? original);
      }
      translations[key] = restored;
    }
    return { translations };
  },
});
```

Production-grade glossaries usually mix this with `instruction` (broad voice and
brand cues) and `overrides` (per-locale exact matches).

## Local LLM (Ollama, LM Studio)

```ts
import OpenAI from 'openai';

export const ollamaProvider = defineProvider({
  name: 'ollama',
  signature: 'ollama:llama3.1-8b:v1',
  async translate({ source, target, items }) {
    const client = new OpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // ignored
    });

    const translations: Record<string, string> = {};
    for (const item of items) {
      const sourceText = typeof item.source === 'string' ? item.source : '';
      const response = await client.chat.completions.create({
        model: 'llama3.1:8b',
        messages: [
          {
            role: 'system',
            content: `Translate ICU MessageFormat from ${source} to ${target}. Preserve placeholders.`,
          },
          { role: 'user', content: sourceText },
        ],
      });
      translations[item.key] =
        response.choices[0]?.message?.content ?? sourceText;
    }
    return { translations };
  },
});
```

This approach is cheap and offline but slower. Don't use it for trees
(`isStructured(item.source) === true`) - the prompt engineering required to keep
ICU intact is too fragile for an 8B model.

## Per-key routing

Route different keys to different providers based on context:

```ts
export const routed = defineProvider({
  name: 'routed',
  signature: 'routed:v1',
  async translate(request) {
    const aiItems = request.items.filter((i) => i.context === 'marketing');
    const deeplItems = request.items.filter((i) => i.context !== 'marketing');
    const [a, b] = await Promise.all([
      ai.translate({ ...request, items: aiItems }),
      deepl.translate({ ...request, items: deeplItems }),
    ]);
    return { translations: { ...a.translations, ...b.translations } };
  },
});
```

`context` comes from `<T context="...">` and `t('...', { $context })`.

## Tips

- **Bump `signature` aggressively.** When you change anything that affects
  output - the model, the prompt, the glossary - bump it. Cache misses are
  cheap; bad translations aren't.

- **Honour `signal`.** Long-running translations should bail when the user hits
  Ctrl-C. The CLI's progress bar relies on it.

- **Forward `instruction` to your model.** It's the system-prompt slot for tone,
  audience, and voice. Don't overload `description` with instruction-shaped
  guidance.

- **Map `description` and `context` into your prompts.** Both are part of every
  `TranslationItem`. They're how authors give translators context; pass them
  through.
