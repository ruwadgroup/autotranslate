import type { StructuredMessage, TranslationNode } from '@autotranslate/core';
import {
  BRANCH_RESERVED_PROPS,
  FORMAT_MARKER_PREFIX,
  MARKER_NAMES,
  mergeAdjacentText,
} from '@autotranslate/core/internal';
import { PLURAL_CATEGORIES, type PluralCategory } from '@autotranslate/core/locale';
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Branch, Currency, DateTime, Num, Plural, RelativeTime, Var } from './markers';

// Identity check is fast and sufficient inside the same module copy. Next.js
// RSC wraps client components in a `React.lazy`-shaped thunk when rendering
// from a server component, in which case we resolve the payload and fall back
// to a `displayName` match.
function markerKindOf(type: unknown): string | null {
  if (typeof type === 'function') {
    if (type === Var) return 'Var';
    if (type === Plural) return 'Plural';
    if (type === Branch) return 'Branch';
    if (type === Num) return 'Num';
    if (type === Currency) return 'Currency';
    if (type === DateTime) return 'DateTime';
    if (type === RelativeTime) return 'RelativeTime';
    const name = (type as { displayName?: string }).displayName;
    if (name && MARKER_NAMES.has(name)) return name;
  }
  if (type && typeof type === 'object') {
    const resolved = resolveLazy(type);
    if (resolved && typeof resolved === 'function') {
      const name = (resolved as { displayName?: string }).displayName;
      if (name && MARKER_NAMES.has(name)) return name;
    }
  }
  return null;
}

interface LazyLike {
  readonly _payload?: { readonly _status?: number; readonly _result?: unknown };
  readonly _init?: (payload: unknown) => unknown;
}

function resolveLazy(type: object): unknown {
  const lazy = type as LazyLike;
  if (!lazy._payload || !lazy._init) return null;
  // 0 = pending, 1 = fulfilled, 2 = rejected.
  if (lazy._payload._status === 1) return lazy._payload._result;
  try {
    return lazy._init(lazy._payload);
  } catch {
    return null;
  }
}

export interface SerializedTree {
  readonly tree: StructuredMessage;
  readonly varSlots: ReadonlyMap<string, ReactNode>;
  readonly pluralSlots: ReadonlyMap<string, PluralSlot>;
  readonly branchSlots: ReadonlyMap<string, BranchSlot>;
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
  readonly formatCount: Map<string, number>;
}

function walk(children: ReactNode, state: WriterState): StructuredMessage {
  const out: TranslationNode[] = [];
  Children.forEach(children, (child) => {
    if (child == null || typeof child === 'boolean') return;
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
      out.push(...walk((props.children as ReactNode) ?? null, state));
      return;
    }
    const kind = markerKindOf(child.type);
    if (kind === 'Var') {
      const name = (props.name as string | undefined) ?? 'value';
      out.push({ type: 'var', name });
      state.varSlots.set(name, (props.children as ReactNode) ?? null);
      return;
    }
    if (kind === 'Plural') {
      const name = (props.name as string | undefined) ?? 'count';
      const value = Number(props.value);
      const forms: { -readonly [K in PluralCategory]?: StructuredMessage } = {};
      const runtimeForms: { -readonly [K in PluralCategory]?: ReactNode } = {};
      for (const cat of PLURAL_CATEGORIES) {
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
    if (kind === 'Branch') {
      const name = (props.name as string | undefined) ?? 'branch';
      const branchValue = props.branch;
      const value = branchValue == null ? 'default' : String(branchValue);
      const cases: { [caseName: string]: StructuredMessage } = {};
      const runtimeCases: { [caseName: string]: ReactNode } = {};
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
    const formatPrefix = kind ? FORMAT_MARKER_PREFIX[kind] : undefined;
    if (formatPrefix) {
      const explicit = (props.name as string | undefined) ?? null;
      const occurrence = state.formatCount.get(formatPrefix) ?? 0;
      state.formatCount.set(formatPrefix, occurrence + 1);
      const name = explicit ?? `${formatPrefix}_${occurrence}`;
      out.push({ type: 'var', name });
      state.varSlots.set(name, child);
      return;
    }

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
  return mergeAdjacentText(out);
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

export function tagKey(tag: string, occurrence: number): string {
  return `${tag}#${occurrence}`;
}
