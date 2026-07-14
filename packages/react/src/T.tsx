import { canonicalKey, type StructuredMessage, type TranslationNode } from '@autotranslate/core';
import { getPluralCategory, type PluralCategory } from '@autotranslate/core/locale';
import {
  cloneElement,
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  useMemo,
} from 'react';
import { useTranslationContext } from './context';
import { type SerializedTree, serializeChildren, tagKey } from './serialize-children';

export interface TProps {
  readonly children: ReactNode;
  /** Translator-facing context. Disambiguates identical copy in different contexts. */
  readonly context?: string;
  /** Translator-facing description. */
  readonly description?: string;
}

/**
 * Translatable JSX block. Walks `children`, derives a canonical key, and
 * renders the catalog entry using the original `<Var>` / `<Plural>` / tag
 * elements as templates. Falls back to `children` on miss.
 */
export function T({ children, context }: TProps): ReactElement {
  const { locale, catalog, fallback, debugMarkers } = useTranslationContext();
  const serialized = useMemo(() => serializeChildren(children), [children]);
  const key = useMemo(() => canonicalKey(serialized.tree, context), [serialized.tree, context]);
  const bareKey = useMemo(
    () => (context ? canonicalKey(serialized.tree) : key),
    [serialized.tree, context, key],
  );

  const entry =
    catalog[key] ??
    (context ? catalog[bareKey] : undefined) ??
    fallback?.[key] ??
    (context ? fallback?.[bareKey] : undefined);
  const rendered = Array.isArray(entry)
    ? renderTree(entry as StructuredMessage, serialized, locale)
    : children;

  if (debugMarkers) {
    // `display: contents` keeps the wrapper out of the layout tree so existing
    // CSS rules keep matching. Dev-only — production should leave this off.
    return (
      <span data-autotranslate={key} style={DEBUG_SPAN_STYLE}>
        {rendered}
      </span>
    );
  }
  return <Fragment>{rendered}</Fragment>;
}

const DEBUG_SPAN_STYLE = { display: 'contents' } as const;

const VOID_HTML_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

interface RenderState {
  readonly tagOccurrence: Map<string, number>;
}

function renderTree(
  tree: StructuredMessage,
  serialized: SerializedTree,
  locale: string,
  state: RenderState = { tagOccurrence: new Map() },
  poundReplacement: string | null = null,
): ReactNode {
  return tree.map((node, i) => {
    const key = `${node.type}-${i}`;
    return (
      <Fragment key={key}>{renderNode(node, serialized, locale, state, poundReplacement)}</Fragment>
    );
  });
}

function renderNode(
  node: TranslationNode,
  serialized: SerializedTree,
  locale: string,
  state: RenderState,
  poundReplacement: string | null,
): ReactNode {
  switch (node.type) {
    case 'text':
      return poundReplacement === null ? node.value : node.value.replace(/#/g, poundReplacement);
    case 'var':
      return serialized.varSlots.get(node.name) ?? `{${node.name}}`;
    case 'plural':
      return renderPlural(node.forms, node.name, serialized, locale, state);
    case 'branch':
      return renderBranch(node.cases, node.name, serialized, locale, state, poundReplacement);
    case 'tag':
      return renderTag(node, serialized, locale, state, poundReplacement);
  }
}

function renderPlural(
  forms: { readonly [K in PluralCategory]?: StructuredMessage },
  slotName: string,
  serialized: SerializedTree,
  locale: string,
  state: RenderState,
): ReactNode {
  const slot = serialized.pluralSlots.get(slotName);
  if (!slot) return null;
  const branch = Number.isFinite(slot.value)
    ? (forms[getPluralCategory(locale, slot.value)] ?? forms.other)
    : forms.other;
  if (!branch) return null;
  const replacement = Number.isFinite(slot.value) ? String(slot.value) : '';
  return renderTree(branch, serialized, locale, state, replacement);
}

function renderBranch(
  cases: { readonly [caseName: string]: StructuredMessage },
  slotName: string,
  serialized: SerializedTree,
  locale: string,
  state: RenderState,
  poundReplacement: string | null,
): ReactNode {
  const slot = serialized.branchSlots.get(slotName);
  if (!slot) return null;
  const branch = cases[slot.value] ?? cases.default;
  if (!branch) return null;
  return renderTree(branch, serialized, locale, state, poundReplacement);
}

function renderTag(
  node: Extract<TranslationNode, { type: 'tag' }>,
  serialized: SerializedTree,
  locale: string,
  state: RenderState,
  poundReplacement: string | null,
): ReactNode {
  const occurrence = state.tagOccurrence.get(node.tag) ?? 0;
  state.tagOccurrence.set(node.tag, occurrence + 1);
  const original = serialized.tagSlots.get(tagKey(node.tag, occurrence));
  const isVoidElement = original
    ? typeof original.type === 'string' && VOID_HTML_ELEMENTS.has(original.type)
    : VOID_HTML_ELEMENTS.has(node.tag);
  if (isVoidElement) {
    return original ? cloneElement(original) : createElement(node.tag);
  }
  const renderedChildren = renderTree(node.children, serialized, locale, state, poundReplacement);
  if (original) return cloneElement(original, undefined, renderedChildren);
  return createElement(node.tag, null, renderedChildren);
}
