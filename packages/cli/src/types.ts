import type { CatalogEntry, Manifest, MessageMeta } from '@autotranslate/core';
import type { AutotranslateConfig } from '@autotranslate/core/config';

export interface ResolvedConfig {
  readonly cwd: string;
  readonly config: AutotranslateConfig;
  /** Absolute path to the catalog directory (`<cwd>/<config.outDir>`). */
  readonly outDir: string;
}

export interface ExtractedMessage {
  readonly key: string;
  readonly source: CatalogEntry;
  readonly meta: MessageMeta;
}

export interface ExtractResult {
  readonly source: Record<string, CatalogEntry>;
  readonly manifest: Manifest;
  readonly fileCount: number;
}

export interface TranslateStats {
  /** Translations newly fetched from the provider. */
  readonly fetched: number;
  /** Translations served from cache. */
  readonly cached: number;
  /** Keys covered by per-locale overrides. */
  readonly overridden: number;
}

export type LocaleStats = Record<string, TranslateStats>;

export interface TranslateResult {
  readonly stats: LocaleStats;
}

export interface CheckProblem {
  readonly locale: string;
  readonly key: string;
  readonly kind: 'missing' | 'orphan' | 'invalid-icu';
  readonly message?: string;
}

export interface CheckResult {
  readonly problems: ReadonlyArray<CheckProblem>;
  readonly ok: boolean;
}

export type { CatalogEntry, Manifest, MessageMeta };
