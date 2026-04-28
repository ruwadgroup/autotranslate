import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { createStubProvider } from '@autotranslate/providers/stub';
import { describe, expect, it } from 'vitest';
import { writeManifest } from './catalog';
import { translate } from './commands/translate';

describe('migration from 0.1.0 flat layout', () => {
  it('upgrades a flat target catalog into chunks on first translate run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-migrate-'));
    const outDir = join(cwd, '.translations');
    await mkdir(outDir, { recursive: true });

    // 0.1.0-style flat catalogs
    await writeFile(join(outDir, 'en.json'), JSON.stringify({ 'Sign out': 'Sign out' }, null, 2));
    await writeManifest(outDir, {
      'Sign out': { occurrences: [{ file: 'src/Header.tsx', line: 1 }] },
    });
    // 0.1.0-style flat cache file (stale; just ensures pruneLegacyCache runs)
    await mkdir(join(outDir, '.cache'), { recursive: true });
    await writeFile(join(outDir, '.cache', 'oldsig.json'), '{}');

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });

    await translate({ cwd, config, outDir }, { provider: createStubProvider() });

    // Source flat file removed
    await expect(stat(join(outDir, 'en.json'))).rejects.toThrow();
    // Target written under chunk layout
    const chunked = await readFile(join(outDir, 'es', 'src', 'Header.json'), 'utf8');
    expect(JSON.parse(chunked)).toEqual({ 'Sign out': 'Sign out' });
    // Legacy cache file pruned
    await expect(stat(join(outDir, '.cache', 'oldsig.json'))).rejects.toThrow();
  });
});
