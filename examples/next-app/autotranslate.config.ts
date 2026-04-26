import 'dotenv/config';
import { defineConfig } from '@autotranslate/core/config';

const openrouterKey = process.env.OPENROUTER_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

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
    'You are translating UI copy for a Next.js example app. ' +
    'Keep the tone friendly, concise, and modern. Preserve product nouns ' +
    '("Next.js", "Vercel", "React") verbatim.',
  provider,
});
