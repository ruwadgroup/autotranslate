import type { Rule, Scope } from 'eslint';
import { TRANSLATOR_FACTORIES } from '../utils/ast';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require translator calls (t / useT / getT) to use string-literal keys; dynamic keys break extraction.',
      url: 'https://github.com/tamimbinhakim/autotranslate/tree/main/packages/eslint-plugin#no-dynamic-key',
    },
    schema: [],
    messages: {
      dynamic:
        'Translator key must be a string literal — dynamic keys break extraction. Inline the literal or build a static key map.',
    },
  },
  create(context) {
    const translatorBindings = new Set<string>();

    function rememberBinding(name: string) {
      translatorBindings.add(name);
    }

    return {
      VariableDeclarator(node) {
        const init = node.init;
        if (init?.type !== 'CallExpression') return;
        if (init.callee.type !== 'Identifier') return;
        if (!TRANSLATOR_FACTORIES.has(init.callee.name)) return;
        if (node.id.type === 'Identifier') rememberBinding(node.id.name);
      },
      AwaitExpression(node) {
        if (node.argument.type !== 'CallExpression') return;
        if (node.argument.callee.type !== 'Identifier') return;
        if (!TRANSLATOR_FACTORIES.has(node.argument.callee.name)) return;
        const declarator = node.parent;
        if (declarator.type === 'VariableDeclarator' && declarator.id.type === 'Identifier') {
          rememberBinding(declarator.id.name);
        }
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (!translatorBindings.has(node.callee.name)) return;
        const arg = node.arguments[0];
        if (!arg) return;
        if (arg.type === 'Literal' && typeof arg.value === 'string') return;
        if (arg.type === 'TemplateLiteral' && arg.expressions.length === 0) return;
        // Identifier references to a same-file string literal are static —
        // accept them so a `const KEY = '...'; t(KEY)` pattern works.
        if (arg.type === 'Identifier' && resolvesToStringLiteral(arg.name, context.sourceCode)) {
          return;
        }
        context.report({ node: arg, messageId: 'dynamic' });
      },
    };
  },
};

function resolvesToStringLiteral(
  name: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  const scope = sourceCode.getScope(sourceCode.ast as unknown as Rule.Node);
  return walkScope(scope, name);
}

function walkScope(scope: Scope.Scope, name: string): boolean {
  for (const variable of scope.variables) {
    if (variable.name !== name) continue;
    for (const def of variable.defs) {
      const init = (def.node as { init?: { type: string; value?: unknown } }).init;
      if (!init) continue;
      if (init.type === 'Literal' && typeof init.value === 'string') return true;
    }
  }
  for (const child of scope.childScopes) {
    if (walkScope(child, name)) return true;
  }
  return false;
}

export default rule;
