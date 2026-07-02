import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceKey } from '@autotranslate/core';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { readChunkedCatalog } from '../catalog';
import { collectExtraction, extract } from './extract';

describe('extract', () => {
  it('extracts <T> and useT calls and writes the source catalog as chunks', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-extract-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(
      join(cwd, 'src', 'a.tsx'),
      `
import { T, useT } from '@autotranslate/react';
export function A() {
  const t = useT();
  return <><T>Welcome</T><button>{t('Sign out')}</button></>;
}
      `,
      'utf8',
    );
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
    });
    const outDir = join(cwd, '.translations');
    const result = await extract({ cwd, config, outDir });

    expect(result.fileCount).toBe(1);
    expect(Object.keys(result.source)).toHaveLength(2);
    expect(result.source[sourceKey('Sign out')]).toBe('Sign out');

    const merged = await readChunkedCatalog(outDir, 'en');
    expect(Object.keys(merged)).toHaveLength(2);
    expect(merged[sourceKey('Sign out')]).toBe('Sign out');
  });

  it('emits outDir/index.ts after extraction', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-extract-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(
      join(cwd, 'src', 'b.tsx'),
      `import { useT } from '@autotranslate/react';
export function B() {
  const t = useT();
  return <span>{t('Hello world')}</span>;
}`,
      'utf8',
    );
    const config = parseConfig({ targets: ['es'], content: ['src/**/*.tsx'] });
    const outDir = join(cwd, '.translations');
    await extract({ cwd, config, outDir });

    const indexContent = await readFile(join(outDir, 'index.ts'), 'utf8');
    expect(indexContent).toContain("export const source = 'en' as const");
    expect(indexContent).toContain('export async function loadCatalog');
    expect(indexContent).toContain("import('./en/");
  });
});

describe('collectExtraction', () => {
  it('returns extracted messages without writing any files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-collect-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(
      join(cwd, 'src', 'd.tsx'),
      `import { useT } from '@autotranslate/react';
export function D() {
  const t = useT();
  return <span>{t('Pure read')}</span>;
}`,
      'utf8',
    );
    const config = parseConfig({ targets: ['es'], content: ['src/**/*.tsx'] });
    const outDir = join(cwd, '.translations');
    const result = await collectExtraction({ cwd, config, outDir });

    expect(result.fileCount).toBe(1);
    expect(result.source[sourceKey('Pure read')]).toBe('Pure read');

    // No files written to outDir.
    await expect(readdir(outDir)).rejects.toThrow();
  });
});
