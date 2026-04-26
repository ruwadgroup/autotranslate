/**
 * Programmatic API for the autotranslate CLI.
 *
 * The bin entry (`autotranslate` command) wraps these functions; importing
 * directly is supported for build pipelines, custom CI checks, and tests.
 */

export const VERSION = '0.0.0';

export type { CatalogFile } from './catalog';
export {
  localeCatalogPath,
  readCatalog,
  readManifest,
  writeCatalog,
  writeManifest,
} from './catalog';
export { check } from './commands/check';
export { extract } from './commands/extract';
export { init } from './commands/init';
export type { TranslateOptions } from './commands/translate';
export { translate } from './commands/translate';
export { ConfigNotFoundError, loadConfig } from './config-loader';
export { resolveProvider } from './provider-resolver';
export type {
  CheckProblem,
  CheckResult,
  ExtractResult,
  LocaleStats,
  ResolvedConfig,
  TranslateResult,
  TranslateStats,
} from './types';
