import type { ESLint, Linter, Rule } from 'eslint';
import noDynamicKey from './rules/no-dynamic-key';
import noUntranslatedJsx from './rules/no-untranslated-jsx';
import validIcuFormat from './rules/valid-icu-format';

export const VERSION = '0.0.0';

/**
 * Map of rule name → rule module. Importable directly for users that want
 * to wire individual rules into a custom config.
 */
export const rules: Readonly<Record<string, Rule.RuleModule>> = {
  'no-untranslated-jsx': noUntranslatedJsx,
  'no-dynamic-key': noDynamicKey,
  'valid-icu-format': validIcuFormat,
};

const meta = {
  name: '@autotranslate/eslint-plugin',
  version: VERSION,
} as const;

const recommendedRules: Readonly<Record<string, Linter.RuleEntry>> = {
  '@autotranslate/no-untranslated-jsx': 'warn',
  '@autotranslate/no-dynamic-key': 'error',
  '@autotranslate/valid-icu-format': 'error',
};

/**
 * Plugin object compatible with both classic (`eslintrc`) and flat (v9+)
 * config. Configs are exported under `configs.recommended` (flat) and
 * `configs['recommended-legacy']` (classic).
 */
const plugin: ESLint.Plugin = {
  meta,
  rules,
  configs: {
    /** Flat-config recommended preset. Apply via `extends`-like spread. */
    recommended: {
      // The plugin reference for flat config is set after the object is
      // constructed (below) to avoid the circular-init pitfall.
      plugins: {},
      rules: recommendedRules,
    },
    /** Legacy `.eslintrc` recommended preset. */
    'recommended-legacy': {
      plugins: ['@autotranslate'],
      rules: recommendedRules,
    },
  },
};

// Wire the flat-config self-reference now that `plugin` is constructed.
const flatRecommended = plugin.configs?.recommended as Linter.Config | undefined;
if (flatRecommended) flatRecommended.plugins = { '@autotranslate': plugin };

export default plugin;
