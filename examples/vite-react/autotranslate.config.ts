import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  // The stub provider in pseudo mode returns wrapped, accented text — perfect
  // for showing the wiring works end-to-end without any AI credentials.
  // Swap to `{ name: 'ai', model: 'anthropic:claude-haiku-4-5', apiKey: process.env.ANTHROPIC_API_KEY }`
  // for real translation.
  provider: { name: 'stub', pseudo: true },
});
