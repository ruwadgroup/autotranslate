import type { StructuredMessage, TranslationNode } from '@autotranslate/core';
import type { PluralCategory } from '@autotranslate/core/locale';
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  BRANCH_RESERVED_PROPS,
  Branch,
  Currency,
  DateTime,
  FORMAT_MARKER_PREFIX,
  Num,
  Plural,
  RelativeTime,
  Var,
} from './markers';

/**
 * Per-tree state collected during serialization. Slots and tag elements are
 * keyed by stable identifiers so the renderer can reconstruct React content
 * for the translated tree without re-walking the source.
 */
export interface SerializedTree {
  /** The canonical structure (used for hashing and translation lookup). */
  readonly tree: StructuredMessage;
  /** `<Var name>` → its rendered children (the runtime value). */
  readonly varSlots: ReadonlyMap<string, ReactNode>;
  /**
   * `<Plural name>` slot data. The renderer uses `value` to pick a CLDR
   * category and substitutes `#` with the formatted number.
   */
  readonly pluralSlots: ReadonlyMap<string, PluralSlot>;
  /**
   * `<Branch name>` slot data. The renderer reads `value` and looks up the
   * matching case (or `default`).
   */
  readonly branchSlots: ReadonlyMap<string, BranchSlot>;
  /**
   * Tag elements keyed by `${tag}#${index}` so the renderer can clone the
   * original element (with its props) when rendering the translated tree.
   */
  readonly tagSlots: ReadonlyMap<string, ReactElement>;
}

export interface PluralSlot {
  readonly value: number;
  readonly forms: { readonly [K in PluralCategory]?: ReactNode };
}

export interface BranchSlot {
  readonly value: string;
  readonly cases: { readonly [caseName: string]: ReactNode };
}

/**
 * Walk React children, building both the canonical message tree and the
 * runtime slot maps the renderer needs to reconstitute React content.
 */
export function serializeChildren(children: ReactNode): SerializedTree {
  const state: WriterState = {
    varSlots: new Map(),
    pluralSlots: new Map(),
    branchSlots: new Map(),
    tagSlots: new Map(),
    tagCount: new Map(),
    formatCount: new Map(),
  };
  const tree = walk(children, state);
  return {
    tree,
    varSlots: state.varSlots,
    pluralSlots: state.pluralSlots,
    branchSlots: state.branchSlots,
    tagSlots: state.tagSlots,
  };
}

interface WriterState {
  readonly varSlots: Map<string, ReactNode>;
  readonly pluralSlots: Map<string, PluralSlot>;
  readonly branchSlots: Map<string, BranchSlot>;
  readonly tagSlots: Map<string, ReactElement>;
  readonly tagCount: Map<string, number>;
  /** Per-formatter counter — keeps `Num`/`Currency`/`DateTime`/`RelativeTime`
   * slot names stable across serializer runs and matched in the extractor. */
  readonly formatCount: Map<string, number>;
}

function walk(children: ReactNode, state: WriterState): StructuredMessage {
  const out: TranslationNode[] = [];
  Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return;
    if (typeof child === 'string') {
      if (child !== '') out.push({ type: 'text', value: child });
      return;
    }
    if (typeof child === 'number') {
      out.push({ type: 'text', value: String(child) });
      return;
    }
    if (!isValidElement(child)) return;

    const props = (child.props as Record<string, unknown>) ?? {};
    if (child.type === Fragment) {
      // Fragments are transparent — recurse into their children without
      // emitting a node for the fragment itself.
      const inner = walk((props.children as ReactNode) ?? null, state);
      out.push(...inner);
      return;
    }
    if (child.type === Var) {
      const name = (props.name as string | undefined) ?? 'value';
      out.push({ type: 'var', name });
      state.varSlots.set(name, (props.children as ReactNode) ?? null);
      return;
    }
    if (child.type === Plural) {
      const name = (props.name as string | undefined) ?? 'count';
      const value = Number(props.value);
      const forms: { -readonly [K in PluralCategory]?: StructuredMessage } = {};
      const runtimeForms: { -readonly [K in PluralCategory]?: ReactNode } = {};
      const cats: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
      for (const cat of cats) {
        const branch = props[cat] as ReactNode | undefined;
        if (branch !== undefined) {
          forms[cat] = walk(branch, state);
          runtimeForms[cat] = branch;
        }
      }
      out.push({ type: 'plural', name, forms });
      state.pluralSlots.set(name, { value, forms: runtimeForms });
      return;
    }
    if (child.type === Branch) {
      const name = (props.name as string | undefined) ?? 'branch';
      const branchValue = props.branch;
      const value =
        branchValue === undefined || branchValue === null ? 'default' : String(branchValue);
      const cases: { [caseName: string]: StructuredMessage } = {};
      const runtimeCases: { [caseName: string]: ReactNode } = {};
      // The default branch is the children prop; all other props (besides
      // reserved ones) are named cases.
      const childrenProp = (props.children as ReactNode | undefined) ?? null;
      if (childrenProp != null && childrenProp !== false) {
        cases.default = walk(childrenProp, state);
        runtimeCases.default = childrenProp;
      }
      for (const propName of Object.keys(props)) {
        if (BRANCH_RESERVED_PROPS.has(propName)) continue;
        const caseValue = props[propName] as ReactNode | undefined;
        if (caseValue === undefined) continue;
        cases[propName] = walk(caseValue, state);
        runtimeCases[propName] = caseValue;
      }
      out.push({ type: 'branch', name, cases });
      state.branchSlots.set(name, { value, cases: runtimeCases });
      return;
    }
    const formatPrefix = isFormatMarker(child.type);
    if (formatPrefix) {
      // Treat formatter components as opaque variable slots. The slot value
      // is the original React element so the formatter can re-render itself
      // (it owns its own locale + Intl logic).
      const explicit = (props.name as string | undefined) ?? null;
      const occurrence = state.formatCount.get(formatPrefix) ?? 0;
      state.formatCount.set(formatPrefix, occurrence + 1);
      const name = explicit ?? `${formatPrefix}#${occurrence}`;
      out.push({ type: 'var', name });
      state.varSlots.set(name, child);
      return;
    }

    // HTML element / unknown component → tag node. We key by tag-name +
    // occurrence index so the renderer can clone the right element when the
    // translated tree references the same tag at the same ordinal position.
    const tag = typeof child.type === 'string' ? child.type : getDisplayName(child);
    const occurrence = state.tagCount.get(tag) ?? 0;
    state.tagCount.set(tag, occurrence + 1);
    state.tagSlots.set(tagKey(tag, occurrence), child);
    out.push({
      type: 'tag',
      tag,
      children: walk((props.children as ReactNode) ?? null, state),
    });
  });
  return mergeText(out);
}

function getDisplayName(element: ReactElement): string {
  const type = element.type;
  if (typeof type === 'function') {
    return (type as { displayName?: string }).displayName ?? type.name ?? 'Component';
  }
  if (typeof type === 'object' && type !== null) {
    return (type as { displayName?: string }).displayName ?? 'Component';
  }
  return 'Component';
}

const FORMAT_MARKER_TYPES: ReadonlyMap<unknown, string> = new Map<unknown, string>([
  [Num, FORMAT_MARKER_PREFIX.Num ?? 'num'],
  [Currency, FORMAT_MARKER_PREFIX.Currency ?? 'currency'],
  [DateTime, FORMAT_MARKER_PREFIX.DateTime ?? 'dt'],
  [RelativeTime, FORMAT_MARKER_PREFIX.RelativeTime ?? 'rel'],
]);

function isFormatMarker(type: unknown): string | null {
  return FORMAT_MARKER_TYPES.get(type) ?? null;
}

/** Key used in `tagSlots` and the parallel renderer counter. */
export function tagKey(tag: string, occurrence: number): string {
  return `${tag}#${occurrence}`;
}

function mergeText(nodes: TranslationNode[]): StructuredMessage {
  const merged: TranslationNode[] = [];
  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (node.type === 'text' && last?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', value: last.value + node.value };
    } else {
      merged.push(node);
    }
  }
  return merged;
}
