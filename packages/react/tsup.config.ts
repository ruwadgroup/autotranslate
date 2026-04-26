import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

// Prepend `"use client";` to the bundled client entry. Required because
// every export in src/index.tsx touches React hooks or context and must be
// a client module under RSC. esbuild strips top-of-file directives, and
// tsup's `banner` option doesn't reliably reach the entry chunk in our
// monorepo, so we patch the output directly.
async function injectUseClient(distDir: string): Promise<void> {
  for (const file of ['index.js', 'index.cjs']) {
    const path = join(distDir, file);
    const body = await readFile(path, 'utf8');
    if (body.startsWith('"use client"')) continue;
    await writeFile(path, `"use client";\n${body}`);
  }
}

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
    server: 'src/server.tsx',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  splitting: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', 'react-dom/server'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  async onSuccess() {
    await injectUseClient('dist');
  },
});
