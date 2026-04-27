import type { CatalogEntry, Manifest, MessageMeta } from '@autotranslate/core';
import type { AutotranslateConfig } from '@autotranslate/core/config';

export interface ResolvedConfig {
  readonly cwd: string;
  readonly config: AutotranslateConfig;
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
  readonly fetched: number;
  readonly cached: number;
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
