export const VERSION = '0.0.0';

export { check } from './commands/check';
export { extract } from './commands/extract';
export type { GenerateTypesResult } from './commands/generate-types';
export { generateTypes } from './commands/generate-types';
export { init } from './commands/init';
export type { TranslateOptions } from './commands/translate';
export { translate } from './commands/translate';
export { ConfigNotFoundError, loadConfig } from './config-loader';
export type {
  CheckProblem,
  CheckResult,
  ExtractResult,
  LocaleStats,
  ResolvedConfig,
  TranslateResult,
  TranslateStats,
} from './types';
