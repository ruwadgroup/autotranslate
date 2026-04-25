/**
 * Translation provider registry for autotranslate.
 *
 * The main entry only carries provider-agnostic helpers and the stub
 * (which has no peer deps). Heavier providers live on subpaths so their
 * peer deps stay opt-in:
 *
 * - `@autotranslate/providers/ai` — Vercel AI SDK
 * - `@autotranslate/providers/deepl` — DeepL (v0.5)
 * - `@autotranslate/providers/google` — Google Cloud Translation (v0.5)
 */

export const VERSION = '0.0.0';

export { pseudoLocalize, pseudoLocalizeTree } from './pseudo';
export type { StubProviderOptions } from './stub';

export { createStubProvider } from './stub';
export type {
  Provider,
  TranslationItem,
  TranslationRequest,
  TranslationResult,
} from './types';
export { defineProvider } from './types';
