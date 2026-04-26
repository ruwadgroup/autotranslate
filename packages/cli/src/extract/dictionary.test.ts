import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractDictionary } from './dictionary';

let cwd: string;

beforeAll(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'autotranslate-dict-'));
  await mkdir(join(cwd, 'src'), { recursive: true });
});

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('extractDictionary', () => {
  it('flattens a JSON dictionary into dot-paths', async () => {
    const path = join(cwd, 'src', 'd.json');
    await writeFile(
      path,
      JSON.stringify({
        common: { save: 'Save', cancel: 'Cancel' },
        dashboard: { stats: { visitors: '{count} visitors' } },
      }),
      'utf8',
    );
    const { messages, manifest } = await extractDictionary(cwd, 'src/d.json');
    expect(messages).toEqual({
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'dashboard.stats.visitors': '{count} visitors',
    });
    expect(manifest['common.save']?.occurrences?.[0]?.file).toBe(join('src', 'd.json'));
  });

  it('throws when the file is missing', async () => {
    await expect(extractDictionary(cwd, 'src/missing.ts')).rejects.toThrow(/not found/i);
  });

  it('throws when the default export is not a plain object', async () => {
    const path = join(cwd, 'src', 'bad.json');
    await writeFile(path, JSON.stringify(['a']), 'utf8');
    await expect(extractDictionary(cwd, 'src/bad.json')).rejects.toThrow(/plain object/i);
  });
});
