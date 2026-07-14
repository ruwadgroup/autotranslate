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

export type { AutotranslatePluginOptions } from './types';
export { VIRTUAL_MODULE_ID } from './types';

interface ResolvedOptions {
  readonly outDir: string;
  readonly source: Locale;
  readonly locales: ReadonlyArray<Locale>;
  /** The autotranslate config's `mode` field (defaults to 'explicit'). */
  readonly mode: 'explicit' | 'auto';
  /** The autotranslate config's `build.frozen` default (true when no config). */
  readonly configBuildFrozen: boolean;
}

/**
 * Vite plugin that bundles autotranslate catalogs into a virtual module.
 *
 * ```ts
 * // vite.config.ts
 * import autotranslate from '@autotranslate/vite';
 *
 * export default defineConfig({ plugins: [autotranslate()] });
 * ```
 *
 * ```ts
 * // app code
 * import { catalogs, source, locales } from 'virtual:autotranslate';
 * ```
 *
 * Editing `.translations/<locale>/*.json` invalidates the virtual module in dev.
 * In dev mode the plugin also starts `createDevLoop` from `@autotranslate/cli`
 * (optional peer) to keep catalogs up-to-date on save.
 * In build mode the plugin runs `checkFrozen` to ensure the committed catalog
 * matches the source code (disabled by `build: { frozen: false }`).
 * When `mode: 'auto'` is set in the autotranslate config, JSX/TSX files are
 * auto-wrapped with `<T>` at compile time via `transformAutoWrap`.
 */
export default function autotranslate(options: AutotranslatePluginOptions = {}): Plugin {
  let cwd = options.cwd ?? process.cwd();
  let cached: Promise<ResolvedOptions> | null = null;
  /** 'serve' during dev, 'build' during production build - captured in configResolved. */
  let command: 'serve' | 'build' = 'serve';
  /** Guard so we only log the cli-not-found warning once per plugin instance. */
  let warnedAboutCli = false;
  /** Cached dynamic import of @autotranslate/cli/transform, per plugin instance. */
  let transformModulePromise: Promise<{
    transformAutoWrap: (
      source: string,
      opts: { filename: string },
    ) => { code: string; changed: boolean };
  } | null> | null = null;

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
          mode: config?.mode ?? 'explicit',
          configBuildFrozen: config?.build?.frozen ?? true,
        };
      })();
    }
    return cached;
  };

  const getTransformModule = () => {
    if (!transformModulePromise) {
      transformModulePromise = import('@autotranslate/cli/transform').catch(() => null);
    }
    return transformModulePromise;
  };

  return {
    name: '@autotranslate/vite',
    // Auto mode must see the original JSX before framework plugins compile it.
    // This also keeps the documented plugin order safe for React applications.
    enforce: 'pre',

    configResolved(viteConfig) {
      if (!options.cwd) cwd = viteConfig.root;
      command = viteConfig.command;
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

      try {
        const cli = await import('@autotranslate/cli');
        const handle = cli.createDevLoop({
          cwd,
          onEvent: (e) => {
            if (e.type === 'error') {
              console.warn('[autotranslate]', (e as { error?: unknown }).error);
            }
          },
        });
        server.httpServer?.on('close', () => {
          handle.close().catch(console.error);
        });
      } catch {
        if (!warnedAboutCli) {
          console.warn(
            '[autotranslate] @autotranslate/cli not resolvable; dev loop disabled. ' +
              'Install @autotranslate/cli to enable automatic translation on save.',
          );
          warnedAboutCli = true;
        }
      }
    },

    async buildStart() {
      if (command !== 'build') return;

      const { configBuildFrozen } = await resolved();
      const effectiveFrozen = options.build?.frozen ?? configBuildFrozen;
      if (!effectiveFrozen) return;

      let cli: typeof import('@autotranslate/cli');
      try {
        cli = await import('@autotranslate/cli');
      } catch {
        if (!warnedAboutCli) {
          console.warn(
            '[autotranslate] @autotranslate/cli not resolvable; frozen-build check skipped. ' +
              'Install @autotranslate/cli to enable catalog verification on build.',
          );
          warnedAboutCli = true;
        }
        return;
      }

      // Use the CLI's loadConfig (returns ResolvedConfig with cwd+outDir context)
      // rather than the plugin's own loadConfig (returns AutotranslateConfig|null).
      let resolvedConfig: Awaited<ReturnType<typeof cli.loadConfig>>;
      try {
        resolvedConfig = await cli.loadConfig(cwd);
      } catch {
        // No autotranslate config found - treat as fresh project, skip check.
        return;
      }

      const report = await cli.checkFrozen(resolvedConfig);
      if (!report.ok) {
        this.error(cli.formatFrozenReport(report));
      }
    },

    async transform(code, id) {
      const { mode } = await resolved();
      if (mode !== 'auto') return undefined;
      if (!/\.[jt]sx$/.test(id)) return undefined;
      if (id.includes('node_modules')) return undefined;

      const mod = await getTransformModule();
      if (!mod) return undefined;

      const result = mod.transformAutoWrap(code, { filename: id });
      if (!result.changed) return undefined;
      return { code: result.code, map: null };
    },
  };
}
