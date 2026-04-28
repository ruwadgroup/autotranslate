import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { defineProvider, type TranslationRequest } from '@autotranslate/providers';
import { describe, expect, it } from 'vitest';
import { writeChunkedCatalog, writeManifest } from '../catalog';
import { translate } from './translate';

const FIXTURE_FILE = 'src/Component.tsx';

describe('translate — glossary', () => {
  it('prepends glossary entries to instruction passed to the provider', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-glossary-'));
    const outDir = join(cwd, '.translations');
    const manifest = {
      'Sign in to autotranslate': { occurrences: [{ file: FIXTURE_FILE, line: 1 }] },
    };
    await writeChunkedCatalog(
      outDir,
      'en',
      { 'Sign in to autotranslate': 'Sign in to autotranslate' },
      manifest,
    );
    await writeManifest(outDir, manifest);

    const calls: TranslationRequest[] = [];
    const provider = defineProvider({
      name: 'cap',
      signature: 'cap:v1',
      async translate(request) {
        calls.push(request);
        const translations: Record<string, string> = {};
        for (const item of request.items) translations[item.key] = `t:${item.source}`;
        return { translations };
      },
    });

    const config = parseConfig({
      targets: ['fr'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
      glossary: ['autotranslate', 'API'],
      instruction: 'Friendly tone.',
    });

    await translate({ cwd, config, outDir }, { provider });
    expect(calls).toHaveLength(1);
    const instruction = calls[0]?.instruction ?? '';
    expect(instruction).toContain('Glossary');
    expect(instruction).toContain('- autotranslate');
    expect(instruction).toContain('- API');
    expect(instruction).toContain('Friendly tone.');
  });

  it('skips the glossary preamble when none configured', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-no-glossary-'));
    const outDir = join(cwd, '.translations');
    const manifest = { Hi: { occurrences: [{ file: FIXTURE_FILE, line: 1 }] } };
    await writeChunkedCatalog(outDir, 'en', { Hi: 'Hi' }, manifest);
    await writeManifest(outDir, manifest);

    const calls: TranslationRequest[] = [];
    const provider = defineProvider({
      name: 'cap',
      signature: 'cap:v2',
      async translate(request) {
        calls.push(request);
        return {
          translations: Object.fromEntries(request.items.map((i) => [i.key, `t:${i.source}`])),
        };
      },
    });

    const config = parseConfig({
      targets: ['fr'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });

    await translate({ cwd, config, outDir }, { provider });
    expect(calls[0]?.instruction).toBeUndefined();
  });
});
