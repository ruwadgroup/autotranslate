import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { init } from './init';

describe('init', () => {
  it('writes autotranslate.config.ts in the target directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-init-'));
    const result = await init({ cwd });
    expect(result.created).toBe(true);
    expect(result.path).toBe(join(cwd, 'autotranslate.config.ts'));
    const content = await readFile(result.path, 'utf8');
    expect(content).toContain('defineConfig');
    expect(content).toContain("targets: ['es', 'fr']");
  });

  it('does not overwrite an existing config without --force', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-init-'));
    await writeFile(join(cwd, 'autotranslate.config.ts'), '// keep me', 'utf8');
    const result = await init({ cwd });
    expect(result.created).toBe(false);
    expect(await readFile(result.path, 'utf8')).toBe('// keep me');
  });

  it('overwrites with force', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-init-'));
    await writeFile(join(cwd, 'autotranslate.config.ts'), '// keep me', 'utf8');
    const result = await init({ cwd, force: true });
    expect(result.created).toBe(true);
    expect(await readFile(result.path, 'utf8')).toContain('defineConfig');
  });
});
