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
