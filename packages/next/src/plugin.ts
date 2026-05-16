/**
 * Next.js config wrapper. Merges `<outDir>/**` into `outputFileTracingIncludes`
 * so `output: "standalone"` (and Vercel's default tracing) ship the catalog
 * alongside the server bundle. Without this, the standalone server's
 * `chdir(__dirname)` leaves cwd pointing somewhere `.translations/` isn't —
 * silent 404 on every catalog read.
 *
 * ```ts
 * export default withAutotranslate({ reactStrictMode: true });
 * ```
 */
export interface WithAutotranslateOptions {
  /** Catalog directory relative to the Next root. Defaults to `.translations`. */
  readonly outDir?: string;
  /** Opt out of trace-includes merging. Defaults to `true`. */
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
