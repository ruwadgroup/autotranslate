import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ai: 'src/ai.ts',
    deepl: 'src/deepl.ts',
    google: 'src/google.ts',
    stub: 'src/stub.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  splitting: true,
  clean: true,
  treeshake: true,
  external: ['ai', '@ai-sdk/anthropic', '@ai-sdk/google', '@ai-sdk/openai'],
});
