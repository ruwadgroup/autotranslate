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
  /**
   * Optional context hint (carries through to the catalog meta as a
   * translator-facing note). Not used at runtime; preserved here so the
   * extractor can capture it.
   */
  readonly context?: string;
  /** Optional translator-facing description. Same story as `context`. */
  readonly description?: string;
}

/**
 * Translatable JSX block.
 *
 * Walks `children` to derive a canonical `StructuredMessage`, looks up the
 * translation in the active catalog (with source-locale fallback), and
 * renders the translated tree using the original `<Var>` / `<Plural>` /
 * tag elements as templates so props (e.g. `<a href>`) and event handlers
 * carry over.
 *
 * On miss, renders `children` verbatim.
 */
export function T({ children, context }: TProps): ReactElement {
  const { locale, catalog, fallback } = useTranslationContext();
  const serialized = useMemo(() => serializeChildren(children), [children]);
  const key = useMemo(() => canonicalKey(serialized.tree, context), [serialized.tree, context]);
  // Bare key (no context) so a context-flavored copy can fall back to the
  // generic translation when the catalog hasn't received a per-context one yet.
  const bareKey = useMemo(
    () => (context ? canonicalKey(serialized.tree) : key),
    [serialized.tree, context, key],
  );

  const entry =
    catalog[key] ??
    (context ? catalog[bareKey] : undefined) ??
    fallback?.[key] ??
    (context ? fallback?.[bareKey] : undefined);
  if (!Array.isArray(entry)) {
    return <Fragment>{children}</Fragment>;
  }
  return <Fragment>{renderTree(entry as StructuredMessage, serialized, locale)}</Fragment>;
}

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
  const renderedChildren = renderTree(node.children, serialized, locale, state, poundReplacement);
  if (original) {
    return cloneElement(original, undefined, renderedChildren);
  }
  // No matching source element — render a bare element so the structure is
  // at least visible. Translators introducing new tags is rare but possible.
  return createElement(node.tag, null, renderedChildren);
}
