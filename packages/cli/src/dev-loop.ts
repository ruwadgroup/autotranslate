import { isAbsolute, join, normalize, sep } from 'node:path';
import type { FSWatcher } from 'chokidar';
import { watch } from 'chokidar';
import { extract } from './commands/extract';
import { generateTypes } from './commands/generate-types';
import { translate } from './commands/translate';
import { loadConfig } from './config-loader';
import type { ExtractResult, ResolvedConfig } from './types';

export interface DevLoopOptions {
  cwd: string;
  resolved?: ResolvedConfig;
  onEvent?: (event: DevLoopEvent) => void;
}

export type DevLoopEvent =
  | { type: 'run-start' }
  | { type: 'run-complete'; extract: ExtractResult; translated: boolean }
  | { type: 'error'; error: unknown };

export interface DevLoopHandle {
  close(): Promise<void>;
}

/**
 * Start a dev loop that watches source files, runs extract -> translate ->
 * generateTypes on each change, and emits structured events.
 *
 * Behavior:
 * - Runs once immediately at startup.
 * - Watches `config.content` globs (cwd-relative) with chokidar, ignoring
 *   outDir and node_modules so pipeline writes never re-trigger.
 * - Debounces file-change triggers to 150ms.
 * - Serializes runs: a trigger that arrives while a run is in progress queues
 *   exactly one trailing run.
 * - Never throws out of the loop: provider / config errors are emitted as
 *   `{ type: 'error' }` events and watching continues.
 * - `close()` stops the watcher and waits for any in-flight run to finish.
 */
export function createDevLoop(options: DevLoopOptions): DevLoopHandle {
  const { cwd, onEvent } = options;
  let resolvedConfig: ResolvedConfig | undefined = options.resolved;
  let watcher: FSWatcher | null = null;
  let closed = false;
  let runPromise: Promise<void> | null = null;
  let pendingRun = false;
  let debounceTimer: NodeJS.Timeout | null = null;

  function scheduleRun(): void {
    if (closed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      trigger();
    }, 150);
  }

  function trigger(): void {
    if (closed) return;
    if (runPromise !== null) {
      // A run is in progress - queue one trailing run.
      pendingRun = true;
      return;
    }
    runPromise = executeRun().finally(() => {
      runPromise = null;
      if (pendingRun && !closed) {
        pendingRun = false;
        trigger();
      }
    });
  }

  async function executeRun(): Promise<void> {
    // Lazily load config on the first run when `resolved` was not pre-provided.
    // Errors surface as events rather than throws so the caller never crashes.
    if (!resolvedConfig) {
      try {
        resolvedConfig = await loadConfig(cwd);
      } catch (error) {
        onEvent?.({ type: 'error', error });
        return;
      }
    }

    const resolved = resolvedConfig;

    if (!watcher && !closed) {
      startWatcher(resolved);
    }

    onEvent?.({ type: 'run-start' });
    try {
      const extractResult = await extract(resolved);
      await translate(resolved);
      await generateTypes(resolved);
      onEvent?.({ type: 'run-complete', extract: extractResult, translated: true });
    } catch (error) {
      onEvent?.({ type: 'error', error });
    }
  }

  function startWatcher(resolved: ResolvedConfig): void {
    const outDir = normalize(resolved.outDir);
    // Chokidar v4 does not expand glob patterns in the paths argument - it
    // treats them as literal filesystem paths.  Extract the static (non-glob)
    // prefix of each content glob so we watch real directories.  The pipeline
    // itself (extract / fast-glob) handles pattern filtering on each run.
    const watchDirs = extractGlobRoots(resolved.config.content);

    watcher = watch(watchDirs, {
      cwd,
      ignoreInitial: true,
      // Ignore paths under outDir (absolute or relative form) and node_modules.
      // Chokidar v4 may report paths as absolute when the watched dir resolves
      // to an absolute path, so normalise before comparing.
      ignored: (filePath: string) => {
        const abs = normalize(isAbsolute(filePath) ? filePath : join(cwd, filePath));
        if (abs === outDir || abs.startsWith(outDir + sep)) return true;
        if (/(^|[\\/])node_modules([\\/]|$)/.test(abs)) return true;
        return false;
      },
    });

    watcher.on('all', () => scheduleRun());
  }

  /**
   * Return the static (non-glob) directory prefixes for a set of glob patterns.
   * These are the directories chokidar needs to watch so that changes inside
   * them are detected; glob-based filtering is handled by fast-glob in the
   * pipeline.
   *
   * Examples:
   *   'src/** /*.tsx'  -> ['src']
   *   '** /*.ts'       -> ['.']
   *   'app/routes/**' -> ['app/routes']
   */
  function extractGlobRoots(globs: ReadonlyArray<string>): string[] {
    const dirs = new Set<string>();
    for (const glob of globs) {
      const parts = glob.split(/[/\\]/);
      const staticParts: string[] = [];
      for (const part of parts) {
        if (/[*?{}[\]!]/.test(part)) break;
        staticParts.push(part);
      }
      dirs.add(staticParts.length > 0 ? staticParts.join('/') : '.');
    }
    return [...dirs];
  }

  trigger();

  return {
    async close(): Promise<void> {
      closed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      // Capture the in-flight promise before closing the watcher so we can
      // await it after the watcher shuts down.
      const inFlight = runPromise;
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
      if (inFlight) {
        await inFlight;
      }
    },
  };
}
