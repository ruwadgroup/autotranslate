import type { StructuredMessage, TranslationNode } from '@autotranslate/core';

const ACCENT_MAP: Readonly<Record<string, string>> = {
  a: 'à',
  b: 'ƀ',
  c: 'ç',
  d: 'đ',
  e: 'é',
  f: 'ƒ',
  g: 'ǵ',
  h: 'ĥ',
  i: 'í',
  j: 'ǰ',
  k: 'ǩ',
  l: 'ĺ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ó',
  p: 'ƥ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'ú',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'À',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Đ',
  E: 'É',
  F: 'Ƒ',
  G: 'Ǵ',
  H: 'Ĥ',
  I: 'Í',
  J: 'J̌',
  K: 'Ǩ',
  L: 'Ĺ',
  M: 'Ḿ',
  N: 'Ñ',
  O: 'Ó',
  P: 'Ƥ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Ú',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/**
 * Accent ASCII letters; leave everything else (whitespace, punctuation,
 * non-Latin scripts, ICU placeholders) untouched.
 */
function accentLetters(input: string): string {
  let out = '';
  for (const ch of input) {
    out += ACCENT_MAP[ch] ?? ch;
  }
  return out;
}

/**
 * Pseudo-localize a string: accent letters and wrap in expansion brackets.
 * Designed to surface untranslated strings, layout overflow, and missing ICU
 * placeholders during dev.
 *
 * ICU-like tokens (`{name}`, `{count, plural, ...}`) and tag wrappers are
 * preserved verbatim — the wrapping is applied to literal segments only.
 */
export function pseudoLocalize(input: string): string {
  let out = '';
  let depth = 0;
  let buffer = '';
  for (const ch of input) {
    if (ch === '{') {
      if (depth === 0 && buffer) {
        out += accentLetters(buffer);
        buffer = '';
      }
      depth++;
      out += ch;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      out += ch;
    } else if (depth > 0) {
      out += ch;
    } else {
      buffer += ch;
    }
  }
  if (buffer) out += accentLetters(buffer);
  return `⟦ ${out} ⟧`;
}

/**
 * Pseudo-localize every text leaf in a structured tree, preserving
 * structure (vars, plurals, tag wrappers).
 */
export function pseudoLocalizeTree(tree: StructuredMessage): StructuredMessage {
  return tree.map((node) => pseudoNode(node));
}

type PluralForms = Extract<TranslationNode, { type: 'plural' }>['forms'];
type BranchCases = Extract<TranslationNode, { type: 'branch' }>['cases'];

function pseudoNode(node: TranslationNode): TranslationNode {
  switch (node.type) {
    case 'text':
      return { type: 'text', value: `⟦ ${accentLetters(node.value)} ⟧` };
    case 'var':
      return node;
    case 'plural':
      return {
        type: 'plural',
        name: node.name,
        forms: Object.fromEntries(
          Object.entries(node.forms).map(([k, v]) => [
            k,
            pseudoLocalizeTree(v as StructuredMessage),
          ]),
        ) as PluralForms,
      };
    case 'branch':
      return {
        type: 'branch',
        name: node.name,
        cases: Object.fromEntries(
          Object.entries(node.cases).map(([k, v]) => [k, pseudoLocalizeTree(v)]),
        ) as BranchCases,
      };
    case 'tag':
      return { type: 'tag', tag: node.tag, children: pseudoLocalizeTree(node.children) };
  }
}
