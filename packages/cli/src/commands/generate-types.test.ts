import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { generateTypes } from './generate-types';

async function setup(catalog: Record<string, unknown>) {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-typegen-'));
  const outDir = join(cwd, '.translations');
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'en.json'), JSON.stringify(catalog), 'utf8');
  const config = parseConfig({
    source: 'en',
    targets: ['es'],
    content: ['src/**/*.tsx'],
  });
  return { cwd, outDir, config };
}

describe('generateTypes', () => {
  it('emits a module augmentation listing every catalog key', async () => {
    const { cwd, outDir, config } = await setup({
      'Sign out': 'Sign out',
      'Hello, {name}!': 'Hello, {name}!',
      't.abc123': [{ type: 'text', value: 'x' }],
    });
    const { path, keyCount } = await generateTypes({ cwd, config, outDir });
    expect(keyCount).toBe(3);
    const contents = await readFile(path, 'utf8');
    expect(contents).toContain("declare module '@autotranslate/core'");
    expect(contents).toContain('"Sign out": true;');
    expect(contents).toContain('"Hello, {name}!": true;');
    expect(contents).toContain('"t.abc123": true;');
  });

  it('emits an empty module when the catalog is empty', async () => {
    const { cwd, outDir, config } = await setup({});
    const { path, keyCount } = await generateTypes({ cwd, config, outDir });
    expect(keyCount).toBe(0);
    const contents = await readFile(path, 'utf8');
    expect(contents).toContain('export {};');
  });

  it('throws a helpful error when the catalog is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-typegen-'));
    const outDir = join(cwd, '.translations');
    const config = parseConfig({
      source: 'en',
      targets: ['es'],
      content: ['src/**/*.tsx'],
    });
    await expect(generateTypes({ cwd, config, outDir })).rejects.toThrow(/extract/i);
  });
});
