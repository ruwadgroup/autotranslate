import type { Rule, Scope } from 'eslint';
import { TRANSLATOR_FACTORIES } from '../utils/ast';

/**
 * Flag dynamic / non-literal keys passed to translator functions
 * (`t(`prefix.${var}`)`, `t(somevar)`). Dynamic keys break extraction —
 * the CLI walks AST literals and can't follow runtime values.
 *
 * Tracks bindings local to each file: identifiers initialized from
 * `useT()`, `useTranslations()`, `getT()`, or `getTranslations()`.
 */
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
        // `const t = useT();` — `t` is a translator. We also accept
        // destructured forms, but the common case is identifier binding.
        if (node.id.type === 'Identifier') rememberBinding(node.id.name);
      },
      AwaitExpression(node) {
        // `const t = await getT(...);`
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
        // Constants resolved through scope — still acceptable since the
        // value is static and the extractor can be taught to follow them
        // later. We accept identifier references that point at literals
        // declared in the same file.
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
