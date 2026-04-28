import type { AutotranslateConfig } from '@autotranslate/core/config';

export interface AutotranslatePluginOptions {
  /** Defaults to the Vite project root. */
  readonly cwd?: string;
  /** Defaults to `config.outDir`, falling back to `.translations`. */
  readonly outDir?: string;
  /** Defaults to `[source, ...targets]` from the loaded config. */
  readonly locales?: ReadonlyArray<string>;
  /** Defaults to `config.source`. */
  readonly source?: string;
  /** Pre-parsed config. Skips disk loading when supplied. */
  readonly config?: AutotranslateConfig;
  /**
   * Enable streaming dev-mode translation: a `/__autotranslate/translate`
   * endpoint accepts `{ key, source }` POSTs in dev, runs the configured
   * provider for the active targets, writes to the chunked catalog, and
   * triggers HMR. Wire the runtime via `createDevOnMissing()` from
   * `@autotranslate/react`.
   *
   * Disabled by default — set `streaming: true` to opt in.
   */
  readonly streaming?: boolean;
}

export const VIRTUAL_MODULE_ID = 'virtual:autotranslate';
export const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
