/**
 * Next.js config wrapper. Currently a typed pass-through — exists as the
 * canonical integration point for future build-time hooks (typegen on
 * `next build`, catalog inlining, dev-mode HMR).
 *
 * ```ts
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
