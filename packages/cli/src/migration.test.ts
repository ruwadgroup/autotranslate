import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceKey } from '@autotranslate/core';
import { parseConfig } from '@autotranslate/core/config';
import { createStubProvider } from '@autotranslate/providers/stub';
import { describe, expect, it } from 'vitest';
import { writeManifest } from './catalog';
import { translate } from './commands/translate';

describe('format migration on translate', () => {
  it('upgrades a 0.1.0 flat literal-keyed catalog into the hash-bucketed layout', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-migrate-'));
    const outDir = join(cwd, '.translations');
    await mkdir(outDir, { recursive: true });

    // 0.1.0-style flat catalogs with literal-string keys
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

    // Source flat file removed.
    await expect(stat(join(outDir, 'en.json'))).rejects.toThrow();

    // Target written under the hash-bucket layout. Bucket name is the first
    // hex digit of the key's hash; we don't pin to a specific letter to avoid
    // re-binding tests on the underlying hash function.
    const targetFiles = await readdir(join(outDir, 'es'));
    expect(targetFiles).toHaveLength(1);
    const bucketFile = targetFiles[0];
    expect(bucketFile).toMatch(/^[0-9a-f]+\.json$/);
    const chunked = await readFile(join(outDir, 'es', bucketFile as string), 'utf8');
    expect(JSON.parse(chunked)).toEqual({ [sourceKey('Sign out')]: 'Sign out' });

    // Legacy cache file pruned
    await expect(stat(join(outDir, '.cache', 'oldsig.json'))).rejects.toThrow();
  });
});
