import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceKey } from '@autotranslate/core';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { writeChunkedCatalog } from '../catalog';
import { check } from './check';

/**
 * Write a locale's catalog in the chunked directory format.
 * Keys are hashed via sourceKey so the on-disk layout matches the canonical format.
 */
async function writeLocale(outDir: string, locale: string, data: Record<string, string>) {
  const hashedCatalog: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    hashedCatalog[sourceKey(k)] = v;
  }
  await writeChunkedCatalog(outDir, locale, hashedCatalog, {});
}

async function fixture(catalogs: Record<string, Record<string, string>>) {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-check-'));
  const outDir = join(cwd, '.translations');
  await mkdir(outDir, { recursive: true });
  for (const [locale, data] of Object.entries(catalogs)) {
    await writeLocale(outDir, locale, data);
  }
  return { cwd, outDir };
}

describe('check', () => {
  it('returns ok when source and targets match', async () => {
    const { cwd, outDir } = await fixture({
      en: { Hi: 'Hi' },
      es: { Hi: 'Hola' },
    });
    const config = parseConfig({ targets: ['es'], content: ['x'], provider: { name: 'stub' } });
    const result = await check({ cwd, config, outDir });
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('reports missing keys in target locales', async () => {
    const { cwd, outDir } = await fixture({
      en: { Hi: 'Hi', Bye: 'Bye' },
      es: { Hi: 'Hola' },
    });
    const config = parseConfig({ targets: ['es'], content: ['x'], provider: { name: 'stub' } });
    const result = await check({ cwd, config, outDir });
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual({
      locale: 'es',
      key: sourceKey('Bye'),
      kind: 'missing',
    });
  });

  it('reports orphans in target locales', async () => {
    const { cwd, outDir } = await fixture({
      en: { Hi: 'Hi' },
      es: { Hi: 'Hola', Old: 'Antiguo' },
    });
    const config = parseConfig({ targets: ['es'], content: ['x'], provider: { name: 'stub' } });
    const result = await check({ cwd, config, outDir });
    expect(result.problems).toContainEqual({ locale: 'es', key: sourceKey('Old'), kind: 'orphan' });
  });

  it('reports invalid ICU strings in source', async () => {
    const { cwd, outDir } = await fixture({
      en: { broken: '{count, plural' },
    });
    const config = parseConfig({ targets: ['es'], content: ['x'], provider: { name: 'stub' } });
    const result = await check({ cwd, config, outDir });
    expect(
      result.problems.some((p) => p.kind === 'invalid-icu' && p.key === sourceKey('broken')),
    ).toBe(true);
  });
});
