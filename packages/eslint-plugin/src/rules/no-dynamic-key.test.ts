import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-dynamic-key';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe('no-dynamic-key', () => {
  it('runs the rule against fixtures', () => {
    // `${x}` inside these strings is a JS-source fixture, not interpolation.
    tester.run('no-dynamic-key', rule, {
      valid: [
        { code: 'const t = useT(); t("Sign out");' },
        { code: 'const t = useT(); t(`Sign out`);' },
        { code: 'const tx = useTranslations("dashboard"); tx("title");' },
        // Local const literal — acceptable, the key is static.
        { code: 'const KEY = "Sign out"; const t = useT(); t(KEY);' },
        // Calls on bindings that aren't translators are ignored.
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source fixture
        { code: 'const t = something(); t(`prefix.${x}`);' },
      ],
      invalid: [
        {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: source fixture
          code: 'const t = useT(); t(`prefix.${x}`);',
          errors: [{ messageId: 'dynamic' }],
        },
        {
          code: 'const t = useT(); t(label);',
          errors: [{ messageId: 'dynamic' }],
        },
        {
          code: 'const t = useTranslations(); t(some.path);',
          errors: [{ messageId: 'dynamic' }],
        },
      ],
    });
  });
});
