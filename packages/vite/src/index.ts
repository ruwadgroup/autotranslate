import { resolve } from 'node:path';
import type { Locale } from '@autotranslate/core';
import type { Plugin } from 'vite';
import { loadCatalogs } from './load-catalogs';
import { loadConfig } from './load-config';
import {
  type AutotranslatePluginOptions,
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from './types';

export const VERSION = '0.0.0';

export type { AutotranslatePluginOptions } from './types';
export { VIRTUAL_MODULE_ID } from './types';

interface ResolvedOptions {
  readonly outDir: string;
  readonly source: Locale;
  readonly locales: ReadonlyArray<Locale>;
}

/**
 * Vite plugin that bundles autotranslate catalogs into a virtual module.
 *
 * ```ts
 * // vite.config.ts
 * import autotranslate from '@autotranslate/vite';
 *
 * export default defineConfig({
 *   plugins: [autotranslate()],
 * });
 * ```
 *
 * In application code:
 *
 * ```ts
 * import { catalogs, source, locales } from 'virtual:autotranslate';
 * ```
 *
 * The plugin auto-loads `autotranslate.config.{ts,mts,js,mjs}` from the
 * Vite project root to discover the source/target locales and the catalog
 * directory. Override any of these via plugin options.
 *
 * Dev-mode HMR: editing `.translations/<locale>.json` (e.g. by re-running
 * `pnpm i18n`) invalidates the virtual module so the running app picks up
 * the new catalogs without a full reload.
 */
export default function autotranslate(options: AutotranslatePluginOptions = {}): Plugin {
  let cwd = options.cwd ?? process.cwd();
  let cached: Promise<ResolvedOptions> | null = null;

  const resolved = (): Promise<ResolvedOptions> => {
    if (!cached) {
      cached = (async () => {
        const config = options.config ?? (await loadConfig(cwd));
        return {
          outDir: options.outDir ?? config?.outDir ?? '.translations',
          source: options.source ?? config?.source ?? 'en',
          locales:
            options.locales ??
            (config ? Array.from(new Set([config.source, ...config.targets])) : ['en']),
        };
      })();
    }
    return cached;
  };

  return {
    name: '@autotranslate/vite',

    configResolved(viteConfig) {
      if (!options.cwd) cwd = viteConfig.root;
    },

    resolveId(id) {
      return id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : undefined;
    },

    async load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return undefined;
      const { outDir, source, locales } = await resolved();
      const { catalogs } = await loadCatalogs(cwd, outDir, source, locales);
      return [
        `export const catalogs = ${JSON.stringify(catalogs)};`,
        `export const source = ${JSON.stringify(source)};`,
        `export const locales = ${JSON.stringify(locales)};`,
      ].join('\n');
    },

    async configureServer(server) {
      const { outDir } = await resolved();
      const watchRoot = resolve(cwd, outDir);
      server.watcher.add(watchRoot);
      server.watcher.on('change', (file) => {
        if (!file.startsWith(watchRoot) || !file.endsWith('.json')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
