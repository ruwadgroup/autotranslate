import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { describe, expect, it } from 'vitest';
import { extract } from './extract';

describe('extract', () => {
  it('extracts <T> and useT calls and writes the source catalog', async () => {
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
    expect(result.source['Sign out']).toBe('Sign out');

    const onDisk = JSON.parse(await readFile(join(outDir, 'en.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(onDisk)).toHaveLength(2);
  });
});
