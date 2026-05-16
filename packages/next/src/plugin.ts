/**
 * Next.js config wrapper. Adds the autotranslate catalog directory to
 * `outputFileTracingIncludes` so `output: "standalone"` (and Vercel's
 * default tracing) ships the runtime catalogs alongside the server bundle.
 *
 * Without this, `getT()` calls `fsCatalogLoader(process.cwd(), ".translations")`
 * inside a standalone server that has already done `process.chdir(__dirname)` —
 * cwd points at the server.js directory, and `.translations/` was never copied
 * there. The result is a silent 404 on every catalog read.
 *
 * ```ts
 * import { withAutotranslate } from '@autotranslate/next/plugin';
 *
 * export default withAutotranslate({
 *   reactStrictMode: true,
 * });
 * ```
 *
 * To opt out of trace-includes (e.g. you ship the catalog separately or
 * deploy without standalone output), pass `{ traceIncludes: false }`.
 */
export interface WithAutotranslateOptions {
  /**
   * Catalog directory, relative to the Next project root. Must match the
   * `outDir` in `autotranslate.config.ts`. Defaults to `.translations`.
   */
  readonly outDir?: string;
  /**
   * Whether to merge `<outDir>/**` into `outputFileTracingIncludes` so the
   * standalone output includes the runtime catalogs. Defaults to `true`.
   */
  readonly traceIncludes?: boolean;
}

type TraceIncludes = Record<string, string[]>;

interface NextConfigShape {
  outputFileTracingIncludes?: TraceIncludes;
  [key: string]: unknown;
}

const ALL_ROUTES_GLOB = '/**/*';

export function withAutotranslate<T extends NextConfigShape>(
  nextConfig: T,
  options: WithAutotranslateOptions = {},
): T & { outputFileTracingIncludes?: TraceIncludes } {
  const { outDir = '.translations', traceIncludes = true } = options;
  if (!traceIncludes) return nextConfig;

  const existing: TraceIncludes = nextConfig.outputFileTracingIncludes ?? {};
  const previous = existing[ALL_ROUTES_GLOB] ?? [];
  const include = `./${outDir}/**/*`;
  const merged = previous.includes(include) ? previous : [...previous, include];

  return {
    ...nextConfig,
    outputFileTracingIncludes: {
      ...existing,
      [ALL_ROUTES_GLOB]: merged,
    },
  };
}
