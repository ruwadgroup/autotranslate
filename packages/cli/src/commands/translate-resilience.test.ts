import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogEntry } from '@autotranslate/core';
import { sourceKey } from '@autotranslate/core';
import { parseConfig } from '@autotranslate/core/config';
import type { Provider, TranslationRequest } from '@autotranslate/providers';
import { describe, expect, it } from 'vitest';
import { readChunkedCatalog, writeChunkedCatalog, writeManifest } from '../catalog';
import { readStateChunk, STATE_DIRNAME } from '../state';
import type { ResolvedConfig } from '../types';
import { translate } from './translate';

const FIXTURE_FILE = 'src/Component.tsx';

async function setupFixture(source: Record<string, string>) {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-resilience-'));
  const outDir = join(cwd, '.translations');
  await writeSource(outDir, source);
  const config = parseConfig({
    targets: ['es'],
    content: ['src/**/*.tsx'],
    provider: { name: 'stub' },
  });
  return { resolved: { cwd, config, outDir } as ResolvedConfig, cwd, outDir };
}

async function writeSource(outDir: string, source: Record<string, string>): Promise<void> {
  const manifest = Object.fromEntries(
    Object.keys(source).map((k) => [k, { occurrences: [{ file: FIXTURE_FILE, line: 1 }] }]),
  );
  await writeChunkedCatalog(outDir, 'en', source, manifest);
  await writeManifest(outDir, manifest);
}

/** Records every request so tests can assert on batching, context and dedup. */
function recordingProvider(
  transform: (key: string, source: CatalogEntry) => CatalogEntry | undefined = (_k, s) => s,
): { provider: Provider; requests: TranslationRequest[] } {
  const requests: TranslationRequest[] = [];
  const provider: Provider = {
    name: 'recording',
    signature: 'recording',
    async translate(request) {
      requests.push(request);
      const translations: Record<string, CatalogEntry> = {};
      for (const item of request.items) {
        const out = transform(item.key, item.source);
        if (out !== undefined) translations[item.key] = out;
      }
      return { translations };
    },
  };
  return { provider, requests };
}

function bigSource(n: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < n; i++) out[sourceKey(`String number ${i}`)] = `String number ${i}`;
  return out;
}

function totalFetched(requests: ReadonlyArray<TranslationRequest>): number {
  return requests.reduce((sum, r) => sum + r.items.length, 0);
}

describe('diffing against committed catalogs', () => {
  it('reuses committed translations across runs and retranslates only changes', async () => {
    const source = bigSource(40);
    const { resolved, outDir } = await setupFixture(source);
    await translate(resolved, { provider: recordingProvider().provider });

    const changedKey = sourceKey('String number 7');
    await writeSource(outDir, { ...source, [changedKey]: 'String number 7 (edited)' });

    const second = recordingProvider();
    const result = await translate(resolved, { provider: second.provider });
    expect(result.stats.es).toEqual({ fetched: 1, cached: 39, overridden: 0 });
    expect(totalFetched(second.requests)).toBe(1);
  });

  it('does not invalidate the catalog when the provider changes', async () => {
    const { resolved } = await setupFixture(bigSource(10));
    await translate(resolved, { provider: recordingProvider().provider });

    const other: Provider = {
      name: 'other',
      signature: 'a-completely-different-provider',
      async translate({ items }) {
        const translations: Record<string, CatalogEntry> = {};
        for (const item of items) translations[item.key] = item.source;
        return { translations };
      },
    };
    const result = await translate(resolved, { provider: other });
    expect(result.stats.es).toEqual({ fetched: 0, cached: 10, overridden: 0 });
  });

  it('migrates the legacy .cache layout instead of paying a cold pass', async () => {
    const source = bigSource(4);
    const { resolved, outDir } = await setupFixture(source);
    await translate(resolved, { provider: recordingProvider().provider });

    // Recreate the pre-1.0 on-disk shape from the current state, then remove
    // the new state dir - this is exactly what an upgrading project looks like.
    const stateDir = join(outDir, STATE_DIRNAME, 'es');
    const legacyDir = join(outDir, '.cache', 'deadbeef', 'en-es');
    await mkdir(legacyDir, { recursive: true });
    let carried = 0;
    for (const file of await readdir(stateDir)) {
      const state = await readStateChunk(join(stateDir, file));
      carried += Object.keys(state.keys).length;
      await writeFile(
        join(legacyDir, file),
        JSON.stringify({
          chunkHash: 'x',
          items: Object.fromEntries(
            Object.entries(state.keys).map(([k, h]) => [k, { sourceHash: h, translation: 'x' }]),
          ),
        }),
        'utf8',
      );
    }
    expect(carried).toBe(4);
    await rm(join(outDir, STATE_DIRNAME), { recursive: true, force: true });

    const second = recordingProvider();
    const result = await translate(resolved, { provider: second.provider });
    expect(totalFetched(second.requests)).toBe(0);
    expect(result.stats.es?.fetched).toBe(0);
  });
});

describe('provider omissions never regress the catalog', () => {
  it('keeps existing translations when the provider omits keys', async () => {
    const { resolved, outDir } = await setupFixture(bigSource(20));
    await translate(resolved, { provider: recordingProvider().provider });
    expect(Object.keys(await readChunkedCatalog(outDir, 'es'))).toHaveLength(20);

    await rm(join(outDir, STATE_DIRNAME), { recursive: true, force: true });
    let n = 0;
    const flaky = recordingProvider((_k, s) => (n++ % 2 === 0 ? s : undefined));
    await translate(resolved, { provider: flaky.provider });

    expect(Object.keys(await readChunkedCatalog(outDir, 'es'))).toHaveLength(20);
  });

  it('retries omitted keys on the next run rather than marking them done', async () => {
    const source = bigSource(6);
    const { resolved } = await setupFixture(source);
    const dropped = sourceKey('String number 3');
    const first = recordingProvider((k, s) => (k === dropped ? undefined : s));
    await translate(resolved, { provider: first.provider });

    const second = recordingProvider();
    const result = await translate(resolved, { provider: second.provider });
    expect(result.stats.es).toEqual({ fetched: 1, cached: 5, overridden: 0 });
    expect(second.requests.flatMap((r) => r.items.map((i) => i.key))).toEqual([dropped]);
  });
});

describe('reference context is bounded', () => {
  it('caps reference items regardless of catalog size', async () => {
    const source = bigSource(400);
    const { resolved, outDir } = await setupFixture(source);
    await translate(resolved, { provider: recordingProvider().provider });

    await writeSource(outDir, { ...source, [sourceKey('Brand new string')]: 'Brand new string' });

    const second = recordingProvider();
    await translate(resolved, { provider: second.provider });
    const req = second.requests.find((r) => r.items.length > 0);
    expect(req?.items).toHaveLength(1);
    expect(req?.context?.length ?? 0).toBeLessThanOrEqual(8);
  });
});

describe('partial failures', () => {
  it('writes every chunk that succeeded and reports the ones that did not', async () => {
    const { resolved, outDir } = await setupFixture(bigSource(200));
    let calls = 0;
    const failing: Provider = {
      name: 'failing',
      signature: 'failing',
      async translate(request) {
        calls++;
        if (calls === 2) throw new Error('429 rate limited');
        const translations: Record<string, CatalogEntry> = {};
        for (const item of request.items) translations[item.key] = item.source;
        return { translations };
      },
    };
    const result = await translate(resolved, { provider: failing, concurrency: 1 });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.error.message).toContain('429');
    const written = Object.keys(await readChunkedCatalog(outDir, 'es'));
    expect(written.length).toBeGreaterThan(0);
    expect(written.length).toBeLessThan(200);
  });

  it('does not drop translations from earlier runs when a chunk fails', async () => {
    const { resolved, outDir } = await setupFixture(bigSource(200));
    await translate(resolved, { provider: recordingProvider().provider });
    expect(Object.keys(await readChunkedCatalog(outDir, 'es'))).toHaveLength(200);

    await rm(join(outDir, STATE_DIRNAME), { recursive: true, force: true });
    const alwaysFailing: Provider = {
      name: 'failing',
      signature: 'failing',
      translate: () => Promise.reject(new Error('provider is down')),
    };
    const result = await translate(resolved, { provider: alwaysFailing });

    expect(result.failures.length).toBeGreaterThan(0);
    expect(Object.keys(await readChunkedCatalog(outDir, 'es'))).toHaveLength(200);
  });
});

describe('duplicate source strings', () => {
  it('sends each distinct source text once per request', async () => {
    const source: Record<string, string> = {};
    for (let i = 0; i < 10; i++) source[sourceKey('Save', `ctx-${i}`)] = 'Save';
    const { resolved, outDir } = await setupFixture(source);
    const rec = recordingProvider();
    const result = await translate(resolved, { provider: rec.provider });

    const sent = rec.requests.flatMap((r) => r.items.map((i) => String(i.source)));
    expect(sent).toEqual(['Save']);
    // Every key still gets the translation, and every key still counts as new.
    expect(result.stats.es?.fetched).toBe(10);
    expect(Object.keys(await readChunkedCatalog(outDir, 'es'))).toHaveLength(10);
  });

  it('does not collapse identical copy carrying different guidance', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-resilience-'));
    const outDir = join(cwd, '.translations');
    const buttonKey = sourceKey('Save', 'button');
    const menuKey = sourceKey('Save', 'menu');
    const source = { [buttonKey]: 'Save', [menuKey]: 'Save' };
    const manifest = {
      [buttonKey]: { occurrences: [{ file: FIXTURE_FILE, line: 1 }], context: 'button' },
      [menuKey]: { occurrences: [{ file: FIXTURE_FILE, line: 2 }], context: 'menu' },
    };
    await writeChunkedCatalog(outDir, 'en', source, manifest);
    await writeManifest(outDir, manifest);
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const rec = recordingProvider();
    await translate({ cwd, config, outDir } as ResolvedConfig, { provider: rec.provider });

    expect(rec.requests.flatMap((r) => r.items.map((i) => i.context)).sort()).toEqual([
      'button',
      'menu',
    ]);
  });
});
