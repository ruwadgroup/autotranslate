import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TEMPLATE = `import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr'],
  content: ['src/**/*.{ts,tsx,js,jsx}'],
  provider: { name: 'stub' },
});
`;

export interface InitOptions {
  readonly cwd?: string;
  readonly force?: boolean;
}

export interface InitResult {
  readonly path: string;
  readonly created: boolean;
}

/** Scaffold `autotranslate.config.ts` in `cwd`. No-op unless `force` is set. */
export async function init(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd();
  const path = resolve(cwd, 'autotranslate.config.ts');
  if (existsSync(path) && !options.force) {
    return { path, created: false };
  }
  await writeFile(path, TEMPLATE, 'utf8');
  return { path, created: true };
}
