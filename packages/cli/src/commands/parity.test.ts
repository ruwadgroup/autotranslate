import { execFile as execFileCb } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { sourceKey } from '@autotranslate/core';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { formatParityReport, parity } from './parity';

const execFile = promisify(execFileCb);

/**
 * Initialise a throwaway git repo with one commit containing base catalogs.
 * Callers pass data using already-hashed keys (or sourceKey() wrappers) to
 * match what the real `extract` command writes on disk.
 */
async function createFixtureRepo(
  baseCatalogs: Record<string, Record<string, string>>,
): Promise<{ cwd: string; outDir: string; baseSha: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-parity-'));
  const outDir = join(cwd, '.translations');

  await execFile('git', ['init'], { cwd });
  await execFile('git', ['config', 'user.email', 'test@example.com'], { cwd });
  await execFile('git', ['config', 'user.name', 'Test'], { cwd });

  // Write base catalogs as chunked-layout files (one json per locale directory,
  // mirroring how writeChunkedCatalog lays out the on-disk tree).
  for (const [locale, data] of Object.entries(baseCatalogs)) {
    const localeDir = join(outDir, locale);
    await mkdir(localeDir, { recursive: true });
    await writeFile(join(localeDir, '0.json'), JSON.stringify(data, null, 2), 'utf8');
  }

  await execFile('git', ['add', '-A'], { cwd });
  await execFile('git', ['commit', '-m', 'base'], { cwd });

  const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd });
  return { cwd, outDir, baseSha: stdout.trim() };
}

/** Write (or overwrite) a locale catalog in the working tree (not committed). */
async function writeWorkingCatalog(
  outDir: string,
  locale: string,
  data: Record<string, string>,
): Promise<void> {
  const localeDir = join(outDir, locale);
  await mkdir(localeDir, { recursive: true });
  await writeFile(join(localeDir, '0.json'), JSON.stringify(data, null, 2), 'utf8');
}

describe('parity', () => {
  it('detects added source keys', async () => {
    // Keys use sourceKey() to match the on-disk format written by extract.
    const skOld = sourceKey('Old text');
    const skNew = sourceKey('New text');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: { [skOld]: 'Old text' },
      es: { [skOld]: 'Texto antiguo' },
    });

    await writeWorkingCatalog(outDir, 'en', {
      [skOld]: 'Old text',
      [skNew]: 'New text',
    });
    await writeWorkingCatalog(outDir, 'es', {
      [skOld]: 'Texto antiguo',
      [skNew]: 'Texto nuevo',
    });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    expect(report.added).toHaveLength(1);
    expect(report.added[0]?.key).toBe(skNew);
    expect(report.added[0]?.sourceText).toBe('New text');
    expect(report.added[0]?.translations.es).toBe('Texto nuevo');
    expect(report.changed).toHaveLength(0);
    expect(report.removed).toHaveLength(0);
  });

  it('detects changed source keys', async () => {
    const skA = sourceKey('Hello');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: { [skA]: 'Hello' },
      es: { [skA]: 'Hola' },
    });

    const skANew = sourceKey('Hello world');
    await writeWorkingCatalog(outDir, 'en', { [skA]: 'Hello world' });
    await writeWorkingCatalog(outDir, 'es', { [skA]: 'Hola mundo' });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    // When the VALUE changes for the same key, that key is detected as changed.
    expect(report.changed).toHaveLength(1);
    expect(report.changed[0]?.key).toBe(skA);
    expect(report.changed[0]?.previousSourceText).toBe('Hello');
    expect(report.changed[0]?.sourceText).toBe('Hello world');
    expect(report.added).toHaveLength(0);
    expect(report.removed).toHaveLength(0);

    // Suppress unused variable warning.
    void skANew;
  });

  it('detects removed source keys', async () => {
    const skA = sourceKey('Hello');
    const skB = sourceKey('Goodbye');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: { [skA]: 'Hello', [skB]: 'Goodbye' },
      es: { [skA]: 'Hola', [skB]: 'Adios' },
    });

    await writeWorkingCatalog(outDir, 'en', { [skA]: 'Hello' });
    await writeWorkingCatalog(outDir, 'es', { [skA]: 'Hola' });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    expect(report.removed).toContain(skB);
    expect(report.added).toHaveLength(0);
    expect(report.changed).toHaveLength(0);
  });

  it('ok is true when all added strings are fully translated', async () => {
    const skNew = sourceKey('New text');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: {},
      es: {},
    });

    await writeWorkingCatalog(outDir, 'en', { [skNew]: 'New text' });
    await writeWorkingCatalog(outDir, 'es', { [skNew]: 'Texto nuevo' });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    expect(report.added).toHaveLength(1);
    expect(report.problems).toHaveLength(0);
    expect(report.ok).toBe(true);
  });

  it('ok is false when a translation is missing', async () => {
    const skA = sourceKey('Hello');
    const skB = sourceKey('World');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: { [skA]: 'Hello' },
      es: { [skA]: 'Hola' },
    });

    // Add a new source key but do NOT provide a Spanish translation.
    await writeWorkingCatalog(outDir, 'en', { [skA]: 'Hello', [skB]: 'World' });
    await writeWorkingCatalog(outDir, 'es', { [skA]: 'Hola' });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.kind === 'missing' && p.key === skB)).toBe(true);
  });

  it('github format: inline snapshot', async () => {
    const skOld = sourceKey('Old source');
    const skNew = sourceKey('New text');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: { [skOld]: 'Old source' },
      es: { [skOld]: 'Fuente vieja' },
    });

    // Add one new key; update the value of the existing key (same hash key,
    // new source value - this exercises the "changed" path).
    await writeWorkingCatalog(outDir, 'en', {
      [skOld]: 'Updated source',
      [skNew]: 'New text',
    });
    await writeWorkingCatalog(outDir, 'es', {
      [skOld]: 'Fuente actualizada',
      [skNew]: 'Texto nuevo',
    });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });
    const output = formatParityReport(report, 'github');

    expect(output).toContain('## autotranslate - catalog parity');
    expect(output).toContain('1 string added');
    expect(output).toContain('1 string changed');
    expect(output).toContain('| source (en) | es |');
    // Changed row shows strikethrough of old source text.
    expect(output).toContain('~~Old source~~');
    expect(output).toContain('<sub>generated by autotranslate parity</sub>');
    expect(output).toContain('all 1 locale');
  });

  it('github format: caps table at 50 rows with +N more line', async () => {
    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: {},
      es: {},
    });

    const enData: Record<string, string> = {};
    const esData: Record<string, string> = {};
    for (let i = 0; i < 60; i++) {
      const k = sourceKey(`Text ${i}`);
      enData[k] = `Text ${i}`;
      esData[k] = `Texto ${i}`;
    }
    await writeWorkingCatalog(outDir, 'en', enData);
    await writeWorkingCatalog(outDir, 'es', esData);

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    expect(report.added).toHaveLength(60);

    const output = formatParityReport(report, 'github');
    expect(output).toContain('+10 more');
    // Count rendered data rows - should be capped at 50.
    const dataRows = output
      .split('\n')
      .filter(
        (l) =>
          l.startsWith('| ') &&
          l.includes(' | ') &&
          !l.includes('source (en)') &&
          !l.includes('---'),
      );
    expect(dataRows.length).toBeLessThanOrEqual(50);
  });

  it('text format: produces plain summary', async () => {
    const skA = sourceKey('Hello');
    const skB = sourceKey('Goodbye');

    const { cwd, outDir, baseSha } = await createFixtureRepo({
      en: { [skA]: 'Hello' },
      es: { [skA]: 'Hola' },
    });

    await writeWorkingCatalog(outDir, 'en', { [skA]: 'Hello', [skB]: 'Goodbye' });
    await writeWorkingCatalog(outDir, 'es', { [skA]: 'Hola', [skB]: 'Adios' });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });
    const output = formatParityReport(report, 'text');

    expect(output).toContain('1 string(s) added');
    expect(output).not.toContain('##');
  });

  it('handles a base ref where the locale did not exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-parity-empty-'));
    await execFile('git', ['init'], { cwd });
    await execFile('git', ['config', 'user.email', 'test@example.com'], { cwd });
    await execFile('git', ['config', 'user.name', 'Test'], { cwd });
    await execFile('git', ['commit', '--allow-empty', '-m', 'empty'], { cwd });
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd });
    const baseSha = stdout.trim();

    const skA = sourceKey('Hello');
    const outDir = join(cwd, '.translations');
    await writeWorkingCatalog(outDir, 'en', { [skA]: 'Hello' });
    await writeWorkingCatalog(outDir, 'es', { [skA]: 'Hola' });

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const report = await parity({ cwd, config, outDir }, { base: baseSha });

    // Everything is "added" since the base was empty.
    expect(report.added).toHaveLength(1);
    expect(report.removed).toHaveLength(0);
    expect(report.ok).toBe(true);
  });
});
