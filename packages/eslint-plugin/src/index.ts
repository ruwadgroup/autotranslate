import type { ESLint, Linter, Rule } from 'eslint';
import noDynamicKey from './rules/no-dynamic-key';
import noUntranslatedJsx from './rules/no-untranslated-jsx';
import validIcuFormat from './rules/valid-icu-format';

export const VERSION = '0.0.0';

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

const plugin: ESLint.Plugin = {
  meta,
  rules,
  configs: {
    recommended: {
      // Self-reference is wired below to avoid a circular-init pitfall.
      plugins: {},
      rules: recommendedRules,
    },
    'recommended-legacy': {
      plugins: ['@autotranslate'],
      rules: recommendedRules,
    },
  },
};

const flatRecommended = plugin.configs?.recommended as Linter.Config | undefined;
if (flatRecommended) flatRecommended.plugins = { '@autotranslate': plugin };

export default plugin;
