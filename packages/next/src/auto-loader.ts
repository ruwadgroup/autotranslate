/**
 * Webpack loader that applies the autotranslate auto-wrap transform to JSX/TSX files.
 *
 * Used automatically when `mode: 'auto'` is set in the autotranslate config and
 * the Next.js plugin is configured via withAutotranslate.
 *
 * The loader lazily requires `@autotranslate/cli/transform` so the CLI package
 * remains an optional peer dependency at runtime.
 */
import { createRequire } from 'node:module';

interface TransformResult {
  code: string;
  changed: boolean;
}

interface TransformModule {
  transformAutoWrap(source: string, options: { filename: string }): TransformResult;
}

// createRequire resolves relative to this file's location; tsup transforms
// import.meta.url to the CJS equivalent (__filename) in the CJS build.
const _require = createRequire(import.meta.url);

export default function autotranslateAutoLoader(
  this: { resourcePath: string },
  source: string,
): string {
  const transform = _require('@autotranslate/cli/transform') as TransformModule;
  return transform.transformAutoWrap(source, { filename: this.resourcePath }).code;
}
