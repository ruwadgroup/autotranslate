import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { writeChunkedCatalog, writeManifest } from '../catalog';
import { checkFrozen, formatFrozenReport } from './check-frozen';

describe('checkFrozen', () => {
  it('returns ok:true with catalogAbsent when source catalog directory is absent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-frozen-'));
    const outDir = join(cwd, '.translations');
    const config = parseConfig({ targets: ['es'], content: ['src/**/*.tsx'] });
    const result = await checkFrozen({ cwd, config, outDir });
    expect(result.ok).toBe(true);
    expect(result.catalogAbsent).toBe(true);
    expect(result.missingSource).toHaveLength(0);
    expect(result.problems).toHaveLength(0);
  });

  it('returns ok:false with missingSource entry and occurrence when a source key is not committed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-frozen-'));
    const outDir = join(cwd, '.translations');
    await mkdir(join(cwd, 'src'), { recursive: true });

    await writeFile(
      join(cwd, 'src', 'Component.tsx'),
      [
        "import { useT } from '@autotranslate/react';",
        'export function C() {',
        '  const t = useT();',
        "  return <button>{t('Check out')}</button>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    await writeChunkedCatalog(outDir, 'en', {}, {});
    await writeManifest(outDir, {});

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
    });

    const result = await checkFrozen({ cwd, config, outDir });
    expect(result.ok).toBe(false);
    expect(result.catalogAbsent).toBe(false);
    expect(result.missingSource).toHaveLength(1);

    const entry = result.missingSource[0];
    expect(entry?.text).toBe('Check out');
    // occurrence must be file:line format
    expect(entry?.occurrence).toMatch(/^src[\\/]Component\.tsx:\d+$/);
  });

  it('returns ok:true when all extracted keys are present in the committed catalog', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-frozen-'));
    const outDir = join(cwd, '.translations');
    await mkdir(join(cwd, 'src'), { recursive: true });

    await writeFile(
      join(cwd, 'src', 'Page.tsx'),
      [
        "import { useT } from '@autotranslate/react';",
        'export function P() {',
        '  const t = useT();',
        "  return <p>{t('Hello')}</p>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    const { sourceKey } = await import('@autotranslate/core');
    const key = sourceKey('Hello');
    await writeChunkedCatalog(outDir, 'en', { [key]: 'Hello' }, { [key]: {} });
    await writeManifest(outDir, { [key]: { occurrences: [{ file: 'src/Page.tsx', line: 4 }] } });
    await writeChunkedCatalog(outDir, 'es', { [key]: 'Hola' }, { [key]: {} });

    const config = parseConfig({ targets: ['es'], content: ['src/**/*.tsx'] });
    const result = await checkFrozen({ cwd, config, outDir });
    expect(result.ok).toBe(true);
    expect(result.missingSource).toHaveLength(0);
    expect(result.problems).toHaveLength(0);
  });
});

describe('formatFrozenReport', () => {
  it('returns empty string for a passing report', () => {
    const report = {
      ok: true,
      catalogAbsent: false,
      missingSource: [],
      problems: [],
    };
    expect(formatFrozenReport(report)).toBe('');
  });

  it('includes text and occurrence for missingSource entries', () => {
    const report = {
      ok: false,
      catalogAbsent: false,
      missingSource: [
        { key: 'abc123', text: 'Check out', occurrence: 'components/Cart.tsx:41' },
        { key: 'def456', text: 'Empty cart', occurrence: 'components/Cart.tsx:58' },
      ],
      problems: [],
    };
    const formatted = formatFrozenReport(report);
    expect(formatted).toContain("'Check out' (components/Cart.tsx:41)");
    expect(formatted).toContain("'Empty cart' (components/Cart.tsx:58)");
    expect(formatted).toContain('2 source strings');
    expect(formatted).toContain('autotranslate translate');
  });

  it('groups target problems by locale', () => {
    const report = {
      ok: false,
      catalogAbsent: false,
      missingSource: [],
      problems: [
        { locale: 'fr', key: 'abc123', kind: 'missing' as const },
        { locale: 'fr', key: 'def456', kind: 'missing' as const },
        { locale: 'de', key: 'abc123', kind: 'orphan' as const },
      ],
    };
    const formatted = formatFrozenReport(report);
    expect(formatted).toContain('2 strings missing in fr');
    expect(formatted).toContain('1 orphan in de');
  });
});
