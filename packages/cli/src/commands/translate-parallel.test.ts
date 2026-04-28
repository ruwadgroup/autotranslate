import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { defineProvider } from '@autotranslate/providers';
import { describe, expect, it } from 'vitest';
import { writeChunkedCatalog, writeManifest } from '../catalog';
import { translate } from './translate';

const FIXTURE_FILE_A = 'src/A.tsx';
const FIXTURE_FILE_B = 'src/B.tsx';

describe('translate — parallelism + progress', () => {
  it('runs chunks concurrently up to the configured limit', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-parallel-'));
    const outDir = join(cwd, '.translations');
    const manifest = {
      a1: { occurrences: [{ file: FIXTURE_FILE_A, line: 1 }] },
      b1: { occurrences: [{ file: FIXTURE_FILE_B, line: 1 }] },
    };
    await writeChunkedCatalog(outDir, 'en', { a1: 'a1', b1: 'b1' }, manifest);
    await writeManifest(outDir, manifest);

    const inFlight = { current: 0, peak: 0 };
    const provider = defineProvider({
      name: 'measure',
      signature: 'measure:v1',
      async translate(request) {
        inFlight.current += 1;
        if (inFlight.current > inFlight.peak) inFlight.peak = inFlight.current;
        await new Promise((r) => setTimeout(r, 30));
        inFlight.current -= 1;
        const translations: Record<string, string> = {};
        for (const item of request.items) {
          translations[item.key] = `t:${item.source}`;
        }
        return { translations };
      },
    });

    const config = parseConfig({
      targets: ['es', 'fr'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
      concurrency: 8,
    });
    await translate({ cwd, config, outDir }, { provider });

    // 2 targets × 2 chunks = 4 tasks; with concurrency 8 they all overlap.
    expect(inFlight.peak).toBeGreaterThanOrEqual(2);
  });

  it('emits started/completed progress events for every chunk', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-progress-'));
    const outDir = join(cwd, '.translations');
    const manifest = {
      a: { occurrences: [{ file: FIXTURE_FILE_A, line: 1 }] },
      b: { occurrences: [{ file: FIXTURE_FILE_B, line: 1 }] },
    };
    await writeChunkedCatalog(outDir, 'en', { a: 'a', b: 'b' }, manifest);
    await writeManifest(outDir, manifest);

    const events: string[] = [];
    const provider = defineProvider({
      name: 'noop',
      signature: 'noop:v1',
      async translate(request) {
        const translations: Record<string, string> = {};
        for (const item of request.items) translations[item.key] = `t:${item.source}`;
        return { translations };
      },
    });
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    await translate(
      { cwd, config, outDir },
      {
        provider,
        onProgress: (event) => {
          events.push(`${event.status}:${event.target}:${event.chunkPath}`);
        },
      },
    );
    // 1 target × 2 chunks × 2 events (started + completed) = 4
    expect(events).toHaveLength(4);
    const startedCount = events.filter((e) => e.startsWith('started')).length;
    const completedCount = events.filter((e) => e.startsWith('completed')).length;
    expect(startedCount).toBe(2);
    expect(completedCount).toBe(2);
  });
});
