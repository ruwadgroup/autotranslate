/**
 * @internal
 *
 * Workspace-internal helpers shared between `@autotranslate/cli`,
 * `@autotranslate/react`, and `@autotranslate/providers`. These exports are
 * NOT part of the public API and may break in any release without notice.
 *
 * Application code should not import from this entry point.
 */

export {
  BRANCH_RESERVED_PROPS,
  canonicalize,
  FORMAT_MARKER_PREFIX,
  MARKER_NAMES,
  mergeAdjacentText,
  TREE_KEY_PREFIX,
} from './jsx-tree';

export {
  applyContextToKey,
  CONTEXT_KEY_SEPARATOR,
} from './runtime';
