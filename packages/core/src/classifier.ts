/** Bump this when the classification rules change in a breaking way. */
export const CLASSIFIER_VERSION = 1;

/** The 8 marker component names that signal translated content. */
export const TRANSLATION_MARKERS: ReadonlySet<string> = new Set([
  'T',
  'Var',
  'Plural',
  'Branch',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
]);

/** True when `text` contains visible content (non-whitespace after collapse). */
export function jsxTextHasContent(text: string): boolean {
  return text.replace(/\s+/g, ' ').trim() !== '';
}

/**
 * The exact 35-entry set of JSX attribute names that are safe to leave as
 * untranslated string literals.
 * Anything starting with 'data-' is also allowlisted (see isAllowlistedAttribute).
 */
const ALLOWLIST_ATTRIBUTES_SET: ReadonlySet<string> = new Set([
  // structural
  'className',
  'class',
  'id',
  'key',
  'ref',
  'name',
  'type',
  'role',
  'slot',
  'style',
  'data-testid',
  // navigation / forms
  'href',
  'src',
  'srcSet',
  'alt',
  'as',
  'rel',
  'target',
  'method',
  'action',
  'encType',
  'autoComplete',
  'autoCorrect',
  'spellCheck',
  'pattern',
  'inputMode',
  // layout
  'width',
  'height',
  'size',
  'tabIndex',
  // semantic but locale-neutral
  'lang',
  'dir',
  'translate',
  // testing
  'data-test',
  'data-cy',
]);

/**
 * True when the JSX attribute `name` is allowlisted:
 * either in the exact 35-entry set or prefixed with 'data-'.
 */
export function isAllowlistedAttribute(name: string): boolean {
  return ALLOWLIST_ATTRIBUTES_SET.has(name) || name.startsWith('data-');
}

/** Attribute that suppresses translation warnings on a JSX element and its subtree. */
export const NO_TRANSLATE_ATTRIBUTE = 'data-no-translate';

/** JSX element names whose text content should never be auto-translated. */
export const SKIP_ELEMENTS: ReadonlySet<string> = new Set(['code', 'pre', 'script', 'style']);
