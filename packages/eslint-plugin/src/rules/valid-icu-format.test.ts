import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './valid-icu-format';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe('valid-icu-format', () => {
  it('runs the rule against fixtures', () => {
    tester.run('valid-icu-format', rule, {
      valid: [
        { code: 'const t = useT(); t("Hello");' },
        { code: 'const t = useT(); t("Hello, {name}!");' },
        { code: 'const t = useT(); t("{count, plural, one {# item} other {# items}}");' },
      ],
      invalid: [
        {
          // Mismatched braces
          code: 'const t = useT(); t("Hello, {name");',
          errors: [{ messageId: 'invalid' }],
        },
        {
          // Bad plural arm
          code: 'const t = useT(); t("{count, plural, =0 {none}");',
          errors: [{ messageId: 'invalid' }],
        },
      ],
    });
  });
});
