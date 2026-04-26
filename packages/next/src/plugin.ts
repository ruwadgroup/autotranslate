/**
 * Next.js config wrapper for autotranslate.
 *
 * Currently a typed pass-through — autotranslate works with stock Next.js,
 * so the plugin doesn't need to inject anything to make the runtime work.
 * It exists as the canonical integration point: future build-time hooks
 * (type generation on `next build`, catalog inlining, dev-mode HMR) will
 * land here without forcing every consumer to change their import.
 *
 * ```ts
 * // next.config.ts
 * import { withAutotranslate } from '@autotranslate/next/plugin';
 *
 * export default withAutotranslate({
 *   reactStrictMode: true,
 * });
 * ```
 */
export function withAutotranslate<T>(nextConfig: T): T {
  return nextConfig;
}
