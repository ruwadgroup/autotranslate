/**
 * Phase-aware Next.js config wrapper for autotranslate.
 *
 * Returns an async function config so Next.js calls it with the current phase.
 * withAutotranslate must be the outermost wrapper in next.config.ts.
 *
 * ```ts
 * export default withAutotranslate({ reactStrictMode: true });
 * ```
 */

import type { NextConfig } from 'next';

const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';
const PHASE_PRODUCTION_BUILD = 'phase-production-build';

const DEV_LOOP_KEY = Symbol.for('autotranslate.devLoop');
const CLI_WARN_KEY = Symbol.for('autotranslate.cliWarn');

// Local types matching @autotranslate/cli shapes (optional peer - no static import).

interface DevLoopRunCompleteEvent {
  type: 'run-complete';
  extract: { fileCount: number; [key: string]: unknown };
  translated: boolean;
}

interface DevLoopErrorEvent {
  type: 'error';
  error: unknown;
}

type DevLoopEvent = { type: 'run-start' } | DevLoopRunCompleteEvent | DevLoopErrorEvent;

interface DevLoopHandle {
  close(): Promise<void>;
}

interface FrozenReport {
  ok: boolean;
  missingSource: ReadonlyArray<{ key: string; text: string; occurrence: string }>;
  problems: ReadonlyArray<unknown>;
  catalogAbsent: boolean;
}

interface CliResolvedConfig {
  cwd: string;
  config: {
    mode: 'explicit' | 'auto';
    build: {
      frozen: boolean;
      translateOnBuild: boolean;
    };
  };
  outDir: string;
}

interface CliModule {
  createDevLoop(options: { cwd: string; onEvent?: (e: DevLoopEvent) => void }): DevLoopHandle;
  loadConfig(cwd: string): Promise<CliResolvedConfig>;
  checkFrozen(resolved: CliResolvedConfig): Promise<FrozenReport>;
  formatFrozenReport(report: FrozenReport): string;
  translate(resolved: CliResolvedConfig): Promise<unknown>;
}

export interface BuildOptions {
  /** Whether to run the frozen-catalog check. Defaults to true. */
  frozen?: boolean;
  /** Whether to run translate before re-checking on failure. Defaults to false. */
  translateOnBuild?: boolean;
}

export interface WithAutotranslateOptions {
  /** Catalog directory relative to the Next root. Defaults to `.translations`. */
  outDir?: string;
  /** Whether to start the dev loop in development. Defaults to true. */
  devLoop?: boolean;
  /** Build-phase frozen-check options. Config-file build settings are the source of truth when not given. */
  build?: BuildOptions;
}

type NextConfigShape = NextConfig;

function warnOnce(g: Record<symbol, unknown>, key: symbol, message: string): void {
  if (!g[key]) {
    g[key] = true;
    console.warn(message);
  }
}

export function withAutotranslate(
  nextConfig: NextConfigShape = {},
  options: WithAutotranslateOptions = {},
): (phase: string, ctx: { defaultConfig?: unknown }) => Promise<NextConfigShape> {
  return async (phase) => {
    const g = globalThis as unknown as Record<symbol, unknown>;

    let cli: CliModule | null = null;
    try {
      cli = (await import('@autotranslate/cli')) as unknown as CliModule;
    } catch {
      warnOnce(
        g,
        CLI_WARN_KEY,
        '[autotranslate] @autotranslate/cli is not installed. ' +
          'Run `pnpm add -D @autotranslate/cli` to enable the dev loop and build checks.',
      );
    }

    let resolvedConfig: CliResolvedConfig | null = null;
    if (cli) {
      try {
        resolvedConfig = await cli.loadConfig(process.cwd());
      } catch {
        // Config file absent or parse error - treat as explicit mode, skip build checks.
      }
    }

    if (phase === PHASE_DEVELOPMENT_SERVER && options.devLoop !== false && cli) {
      // next.config is evaluated several times per dev server; the symbol on
      // globalThis keeps exactly one loop alive across those evaluations.
      if (!g[DEV_LOOP_KEY]) {
        g[DEV_LOOP_KEY] = true;
        cli.createDevLoop({
          cwd: process.cwd(),
          onEvent: (e: DevLoopEvent) => {
            if (e.type === 'error') {
              console.warn('[autotranslate]', (e as DevLoopErrorEvent).error);
            } else if (e.type === 'run-complete') {
              const ev = e as DevLoopRunCompleteEvent;
              const fileCount = ev.extract.fileCount;
              const wasTranslated = ev.translated;
              console.log(
                `[autotranslate] run complete: ${fileCount} files extracted, translated: ${wasTranslated}`,
              );
            }
          },
        });
      }
    }

    if (phase === PHASE_PRODUCTION_BUILD && cli && resolvedConfig) {
      const doFrozen = options.build?.frozen ?? resolvedConfig.config.build.frozen;

      if (doFrozen) {
        const report = await cli.checkFrozen(resolvedConfig);

        if (!report.ok && !report.catalogAbsent) {
          const doTranslate =
            options.build?.translateOnBuild ?? resolvedConfig.config.build.translateOnBuild;

          if (doTranslate) {
            await cli.translate(resolvedConfig);
            const report2 = await cli.checkFrozen(resolvedConfig);
            if (!report2.ok && !report2.catalogAbsent) {
              throw new Error(cli.formatFrozenReport(report2));
            }
          } else {
            throw new Error(cli.formatFrozenReport(report));
          }
        }
      }
    }

    const mode = resolvedConfig?.config.mode ?? 'explicit';

    const config: NextConfigShape = { ...nextConfig };

    if (mode === 'auto') {
      const userWebpack = nextConfig.webpack;
      config.webpack = (webpackConfig, webpackOptions) => {
        const cfg = (userWebpack ? userWebpack(webpackConfig, webpackOptions) : webpackConfig) as {
          module?: { rules?: unknown[] };
        };

        if (!cfg.module) cfg.module = { rules: [] };
        if (!cfg.module.rules) cfg.module.rules = [];

        cfg.module.rules.unshift({
          test: /\.[jt]sx$/,
          exclude: /node_modules/,
          use: [{ loader: '@autotranslate/next/auto-loader' }],
        });

        return cfg;
      };

      const existingTurbopack = config.turbopack ?? {};
      const existingRules = (existingTurbopack as { rules?: Record<string, unknown> }).rules ?? {};
      config.turbopack = {
        ...existingTurbopack,
        rules: {
          ...existingRules,
          '*.tsx': { loaders: ['@autotranslate/next/auto-loader'] },
          '*.jsx': { loaders: ['@autotranslate/next/auto-loader'] },
        },
      };
    }

    return config;
  };
}
