import type { AutotranslateConfig } from '@autotranslate/core/config';

export interface AutotranslatePluginOptions {
  /**
   * Project root used to resolve `autotranslate.config.ts`. Defaults to the
   * Vite project root (`config.root`).
   */
  readonly cwd?: string;
  /**
   * Path to the catalog directory, relative to `cwd`. Defaults to the value
   * in `autotranslate.config.ts` (which itself defaults to `.translations`).
   * Set this to bypass config-loading entirely.
   */
  readonly outDir?: string;
  /**
   * Target locales to expose. Defaults to `[source, ...targets]` from the
   * loaded config.
   */
  readonly locales?: ReadonlyArray<string>;
  /**
   * Source locale used as the runtime fallback. Defaults to
   * `config.source`.
   */
  readonly source?: string;
  /**
   * Pre-parsed config. When supplied, the plugin skips disk loading.
   * Useful when you already import `autotranslate.config.ts` in the Vite
   * config for other reasons.
   */
  readonly config?: AutotranslateConfig;
}

export const VIRTUAL_MODULE_ID = 'virtual:autotranslate';
export const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
