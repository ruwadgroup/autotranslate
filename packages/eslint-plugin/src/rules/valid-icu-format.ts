import { ICUParseError, parseICU } from '@autotranslate/core/icu';
import type { Rule } from 'eslint';
import { TRANSLATOR_FACTORIES } from '../utils/ast';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Verify that translator string keys parse as valid ICU MessageFormat.',
      url: 'https://github.com/tamimbinhakim/autotranslate/tree/main/packages/eslint-plugin#valid-icu-format',
    },
    schema: [],
    messages: {
      invalid: 'Invalid ICU message: {{ reason }}',
    },
  },
  create(context) {
    const translatorBindings = new Set<string>();

    return {
      VariableDeclarator(node) {
        const init = node.init;
        if (!init) return;
        const callee =
          init.type === 'CallExpression'
            ? init.callee
            : init.type === 'AwaitExpression' && init.argument.type === 'CallExpression'
              ? init.argument.callee
              : null;
        if (callee?.type !== 'Identifier') return;
        if (!TRANSLATOR_FACTORIES.has(callee.name)) return;
        if (node.id.type === 'Identifier') translatorBindings.add(node.id.name);
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (!translatorBindings.has(node.callee.name)) return;
        const arg = node.arguments[0];
        if (!arg) return;
        const literal = readLiteralKey(arg);
        if (literal === null) return;
        try {
          parseICU(literal);
        } catch (error) {
          const reason =
            error instanceof ICUParseError ? extractParseReason(error) : (error as Error).message;
          context.report({ node: arg, messageId: 'invalid', data: { reason } });
        }
      },
    };
  },
};

function readLiteralKey(node: { type: string }): string | null {
  if (node.type === 'Literal') {
    const value = (node as { value?: unknown }).value;
    return typeof value === 'string' ? value : null;
  }
  if (node.type === 'TemplateLiteral') {
    const tl = node as unknown as {
      expressions: ReadonlyArray<unknown>;
      quasis: ReadonlyArray<{ value: { cooked?: string } }>;
    };
    if (tl.expressions.length === 0) return tl.quasis[0]?.value.cooked ?? '';
  }
  return null;
}

function extractParseReason(error: ICUParseError): string {
  const cause = error.cause as { message?: string } | undefined;
  return cause?.message ?? error.message;
}

export default rule;
