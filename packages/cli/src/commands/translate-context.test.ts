import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import {
  defineProvider,
  type Provider,
  type TranslationContextItem,
  type TranslationRequest,
} from '@autotranslate/providers';
import { describe, expect, it } from 'vitest';
import { writeChunkedCatalog, writeManifest } from '../catalog';
import { translate } from './translate';

const FIXTURE_FILE = 'src/Component.tsx';

function captureProvider(): {
  provider: Provider;
  calls: TranslationRequest[];
} {
  const calls: TranslationRequest[] = [];
  const provider = defineProvider({
    name: 'capture',
    signature: 'capture:v1',
    async translate(request) {
      calls.push(request);
      const translations: Record<string, string> = {};
      for (const item of request.items) {
        translations[item.key] =
          `t:${typeof item.source === 'string' ? item.source : JSON.stringify(item.source)}`;
      }
      return { translations };
    },
  });
  return { provider, calls };
}

describe('translate — context prefix', () => {
  it('passes already-translated neighbours as context on partial diffs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-ctx-'));
    const outDir = join(cwd, '.translations');
    const manifest = {
      'Sign out': { occurrences: [{ file: FIXTURE_FILE, line: 1 }] },
      Hello: { occurrences: [{ file: FIXTURE_FILE, line: 2 }] },
      Goodbye: { occurrences: [{ file: FIXTURE_FILE, line: 3 }] },
    };
    await writeChunkedCatalog(
      outDir,
      'en',
      { 'Sign out': 'Sign out', Hello: 'Hello', Goodbye: 'Goodbye' },
      manifest,
    );
    await writeManifest(outDir, manifest);

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });

    // First run translates all three.
    const first = captureProvider();
    await translate({ cwd, config, outDir }, { provider: first.provider });
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0]?.items).toHaveLength(3);
    expect(first.calls[0]?.context ?? []).toEqual([]);

    // Second run with one source string changed.
    await writeChunkedCatalog(
      outDir,
      'en',
      { 'Sign out': 'Log out', Hello: 'Hello', Goodbye: 'Goodbye' },
      manifest,
    );
    const second = captureProvider();
    await translate({ cwd, config, outDir }, { provider: second.provider });

    expect(second.calls).toHaveLength(1);
    expect(second.calls[0]?.items).toHaveLength(1);
    expect(second.calls[0]?.items[0]?.key).toBe('Sign out');
    const context = second.calls[0]?.context ?? [];
    expect(context).toHaveLength(2);
    const sources = context.map((c: TranslationContextItem) => c.source).sort();
    expect(sources).toEqual(['Goodbye', 'Hello']);
  });
});
