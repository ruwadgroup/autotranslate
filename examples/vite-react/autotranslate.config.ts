import 'dotenv/config';
import { defineConfig } from '@autotranslate/core/config';

const openrouterKey = process.env.OPENROUTER_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

// Pick the first credential present. OpenRouter wins because it gives access
// to many vendors with one key; OpenAI is a direct fallback. Without either,
// the stub-pseudo provider keeps `pnpm i18n` working out-of-the-box.
const provider = openrouterKey
  ? ({
      name: 'ai',
      model: 'openrouter:openai/gpt-4o-mini',
      apiKey: openrouterKey,
    } as const)
  : openaiKey
    ? ({
        name: 'ai',
        model: 'openai:gpt-4o-mini',
        apiKey: openaiKey,
      } as const)
    : ({
        name: 'stub',
        pseudo: true,
      } as const);

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  instruction:
    'You are translating UI copy for a developer-tools example app. ' +
    'Keep the tone friendly, concise, and modern. Preserve product nouns ' +
    '("Vite", "React", "HMR") verbatim.',
  provider,
});
