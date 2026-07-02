import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { writeChunkedCatalog, writeManifest } from '../catalog';
import { generateTypes } from './generate-types';

/**
 * Write a locale catalog in the chunked directory format.
 * Accepts either string values (plain strings) or CatalogEntry values.
 * No key migration — the fixture keys must already be in canonical form.
 */
async function setup(catalog: Record<string, unknown>) {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-typegen-'));
  const outDir = join(cwd, '.translations');
  await mkdir(outDir, { recursive: true });

  // Write catalog in chunked format (directory-based).
  await writeChunkedCatalog(
    outDir,
    'en',
    catalog as Record<string, import('@autotranslate/core').CatalogEntry>,
    {},
  );
  await writeManifest(outDir, {});

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
      't.abcdef012345': [{ type: 'text', value: 'x' }],
    });
    const { path, keyCount } = await generateTypes({ cwd, config, outDir });
    expect(keyCount).toBe(3);
    const contents = await readFile(path, 'utf8');
    expect(contents).toContain("declare module '@autotranslate/core'");
    // Source strings exposed verbatim so `t('Sign out')` narrows.
    expect(contents).toContain('"Sign out": true;');
    expect(contents).toContain('"Hello, {name}!": true;');
    // Tree entries surface their hashed key — there's no readable string form.
    expect(contents).toContain('"t.abcdef012345": true;');
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
