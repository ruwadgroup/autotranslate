import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceKey } from '@autotranslate/core';
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

// All four hash to bucket '4' under the default chunkBits=4 layout. We need
// the test fixtures to share a bucket so the context-prefix path actually
// fires (it pulls neighbours from the same chunk file).
const SIGN_OUT = sourceKey('Sign out');
const FAREWELL = sourceKey('Farewell');
const ABOUT = sourceKey('About');
const LOG_OUT = sourceKey('Log out');

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
      [SIGN_OUT]: { occurrences: [{ file: FIXTURE_FILE, line: 1 }] },
      [FAREWELL]: { occurrences: [{ file: FIXTURE_FILE, line: 2 }] },
      [ABOUT]: { occurrences: [{ file: FIXTURE_FILE, line: 3 }] },
    };
    await writeChunkedCatalog(
      outDir,
      'en',
      { [SIGN_OUT]: 'Sign out', [FAREWELL]: 'Farewell', [ABOUT]: 'About' },
      manifest,
    );
    await writeManifest(outDir, manifest);

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });

    // First run: all three keys land in the same bucket → one provider call.
    const first = captureProvider();
    await translate({ cwd, config, outDir }, { provider: first.provider });
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0]?.items).toHaveLength(3);
    expect(first.calls[0]?.context ?? []).toEqual([]);

    // Replace one key with a new string in the same bucket. The other two
    // entries persist; cache hits make them context for the new fetch.
    const newManifest = {
      [LOG_OUT]: { occurrences: [{ file: FIXTURE_FILE, line: 1 }] },
      [FAREWELL]: { occurrences: [{ file: FIXTURE_FILE, line: 2 }] },
      [ABOUT]: { occurrences: [{ file: FIXTURE_FILE, line: 3 }] },
    };
    await writeChunkedCatalog(
      outDir,
      'en',
      { [LOG_OUT]: 'Log out', [FAREWELL]: 'Farewell', [ABOUT]: 'About' },
      newManifest,
    );
    await writeManifest(outDir, newManifest);

    const second = captureProvider();
    await translate({ cwd, config, outDir }, { provider: second.provider });

    expect(second.calls).toHaveLength(1);
    expect(second.calls[0]?.items).toHaveLength(1);
    expect(second.calls[0]?.items[0]?.key).toBe(LOG_OUT);
    const context = second.calls[0]?.context ?? [];
    expect(context).toHaveLength(2);
    const sources = context.map((c: TranslationContextItem) => c.source).sort();
    expect(sources).toEqual(['About', 'Farewell']);
  });
});
