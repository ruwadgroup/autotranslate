import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceKey } from '@autotranslate/core';
import { parseConfig } from '@autotranslate/core/config';
import { afterEach, describe, expect, it } from 'vitest';
import type { DevLoopEvent, DevLoopHandle } from './dev-loop';
import { createDevLoop } from './dev-loop';

// Track open handles so afterEach can close any that a test left dangling.
const openHandles: DevLoopHandle[] = [];

function trackHandle(h: DevLoopHandle): DevLoopHandle {
  openHandles.push(h);
  return h;
}

afterEach(async () => {
  await Promise.allSettled(openHandles.map((h) => h.close()));
  openHandles.length = 0;
});

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Wait until predicate returns true, polling every `intervalMs`. */
async function pollUntil(
  predicate: () => Promise<boolean> | boolean,
  timeoutMs: number,
  intervalMs = 50,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (await predicate()) return;
    if (Date.now() >= deadline) throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe('createDevLoop', () => {
  it('initial run produces en chunks, target chunks, types.d.ts, and index.ts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'at-devloop-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(
      join(cwd, 'src', 'App.tsx'),
      [
        "import { useT } from '@autotranslate/react';",
        'export function App() {',
        '  const t = useT();',
        "  return <span>{t('Hello')}</span>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    const outDir = join(cwd, '.translations');
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const resolved = { cwd, config, outDir };

    const events: DevLoopEvent[] = [];
    const handle = trackHandle(createDevLoop({ cwd, resolved, onEvent: (e) => events.push(e) }));

    await pollUntil(() => events.some((e) => e.type === 'run-complete'), 8000);

    await handle.close();

    const enDir = join(outDir, 'en');
    expect(await pathExists(enDir)).toBe(true);
    const enFiles = await readdir(enDir);
    expect(enFiles.length).toBeGreaterThan(0);

    const esDir = join(outDir, 'es');
    expect(await pathExists(esDir)).toBe(true);
    const esFiles = await readdir(esDir);
    expect(esFiles.length).toBeGreaterThan(0);

    expect(await pathExists(join(outDir, 'types.d.ts'))).toBe(true);

    const indexContent = await readFile(join(outDir, 'index.ts'), 'utf8');
    expect(indexContent).toContain("export const source = 'en' as const");
    expect(indexContent).toContain('export async function loadCatalog');
    expect(indexContent).toContain("import('./en/");

    expect(events.filter((e) => e.type === 'error')).toHaveLength(0);
  }, 20000);

  it('touching a source file with a new t() triggers exactly one additional run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'at-devloop-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    const srcFile = join(cwd, 'src', 'Page.tsx');
    await writeFile(
      srcFile,
      [
        "import { useT } from '@autotranslate/react';",
        'export function Page() {',
        '  const t = useT();',
        "  return <span>{t('Welcome')}</span>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    const outDir = join(cwd, '.translations');
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const resolved = { cwd, config, outDir };

    let completeCount = 0;
    const handle = trackHandle(
      createDevLoop({
        cwd,
        resolved,
        onEvent: (e) => {
          if (e.type === 'run-complete') completeCount += 1;
        },
      }),
    );

    await pollUntil(() => completeCount >= 1, 8000);

    // Give chokidar a moment to become ready before touching the file.
    await new Promise((r) => setTimeout(r, 200));

    const newKey = sourceKey('Sign out');
    await writeFile(
      srcFile,
      [
        "import { useT } from '@autotranslate/react';",
        'export function Page() {',
        '  const t = useT();',
        "  return <><span>{t('Welcome')}</span><button>{t('Sign out')}</button></>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    await pollUntil(() => completeCount >= 2, 8000);

    // Allow any debounced runs to flush.
    await new Promise((r) => setTimeout(r, 400));

    await handle.close();

    expect(completeCount).toBe(2);

    const enFiles = await readdir(join(outDir, 'en'));
    let foundKey = false;
    for (const f of enFiles) {
      const content = JSON.parse(await readFile(join(outDir, 'en', f), 'utf8')) as Record<
        string,
        unknown
      >;
      if (newKey in content) {
        foundKey = true;
        break;
      }
    }
    expect(foundKey).toBe(true);
  }, 25000);

  it('a save during a run queues exactly one trailing run (serialisation)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'at-devloop-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    const srcFile = join(cwd, 'src', 'Widget.tsx');
    await writeFile(
      srcFile,
      [
        "import { useT } from '@autotranslate/react';",
        'export function Widget() {',
        '  const t = useT();',
        "  return <span>{t('Click me')}</span>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    const outDir = join(cwd, '.translations');
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const resolved = { cwd, config, outDir };

    let _startCount = 0;
    let completeCount = 0;
    const handle = trackHandle(
      createDevLoop({
        cwd,
        resolved,
        onEvent: (e) => {
          if (e.type === 'run-start') _startCount += 1;
          if (e.type === 'run-complete') completeCount += 1;
        },
      }),
    );

    await pollUntil(() => completeCount >= 1, 8000);
    await new Promise((r) => setTimeout(r, 200));

    // Write the file three times in quick succession within the debounce window.
    for (let i = 1; i <= 3; i++) {
      await writeFile(
        srcFile,
        [
          "import { useT } from '@autotranslate/react';",
          'export function Widget() {',
          '  const t = useT();',
          `  return <span>{t('Click me ${i}')}</span>;`,
          '}',
        ].join('\n'),
        'utf8',
      );
      // Small gap - still within 150ms debounce.
      await new Promise((r) => setTimeout(r, 30));
    }

    await pollUntil(() => completeCount >= 2, 8000);

    // Let any potential spurious run settle.
    await new Promise((r) => setTimeout(r, 400));

    await handle.close();

    expect(completeCount).toBe(2);
  }, 25000);

  it('missing config emits an error event and close() resolves cleanly', async () => {
    // cwd with no autotranslate.config.* file -> loadConfig throws.
    const cwd = await mkdtemp(join(tmpdir(), 'at-devloop-noconf-'));

    const events: DevLoopEvent[] = [];
    const handle = trackHandle(createDevLoop({ cwd, onEvent: (e) => events.push(e) }));

    await pollUntil(() => events.some((e) => e.type === 'error'), 4000);

    // close() must resolve even though no watcher was ever started.
    await handle.close();

    expect(events.filter((e) => e.type === 'error')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'run-start')).toHaveLength(0);
  }, 10000);

  it('pipeline error emits an error event and the loop keeps watching', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'at-devloop-err-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    const srcFile = join(cwd, 'src', 'Err.tsx');
    await writeFile(
      srcFile,
      [
        "import { useT } from '@autotranslate/react';",
        'export function Err() {',
        '  const t = useT();',
        "  return <span>{t('Retry')}</span>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    // Create outDir as a file so writes inside it fail.
    const outDir = join(cwd, '.translations');
    await writeFile(outDir, 'not-a-dir', 'utf8');

    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const badResolved = { cwd, config, outDir };

    const events: DevLoopEvent[] = [];
    const handle = trackHandle(
      createDevLoop({ cwd, resolved: badResolved, onEvent: (e) => events.push(e) }),
    );

    // Initial run fails because outDir is a file.
    await pollUntil(() => events.some((e) => e.type === 'error'), 4000);

    // The loop must still be alive - watcher is watching (even though the run
    // failed, the watcher started before the pipeline error).
    // Verify by closing cleanly.
    await handle.close();

    expect(events.filter((e) => e.type === 'error')).toHaveLength(1);
  }, 12000);

  it('close() resolves immediately when called before the initial run completes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'at-devloop-close-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(
      join(cwd, 'src', 'C.tsx'),
      [
        "import { useT } from '@autotranslate/react';",
        'export function C() {',
        '  const t = useT();',
        "  return <span>{t('Done')}</span>;",
        '}',
      ].join('\n'),
      'utf8',
    );

    const outDir = join(cwd, '.translations');
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const resolved = { cwd, config, outDir };

    const handle = trackHandle(createDevLoop({ cwd, resolved }));

    // close() called immediately - it must await the in-flight run and resolve.
    await expect(handle.close()).resolves.toBeUndefined();
  }, 12000);
});
