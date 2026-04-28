'use client';

import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';

/** Map of experiment id → active variant id. Build it from your flag system. */
export type ExperimentAssignments = Readonly<Record<string, string>>;

interface ABContextValue {
  readonly assignments: ExperimentAssignments;
  readonly defaultVariant: (experimentId: string) => string;
}

const DEFAULT_VARIANT = 'control';

const ABContext = createContext<ABContextValue>({
  assignments: {},
  defaultVariant: () => DEFAULT_VARIANT,
});

export interface ABProviderProps {
  /** Active variant id per experiment. Resolve from your flag system upstream. */
  readonly assignments: ExperimentAssignments;
  /**
   * Default variant id when an experiment isn't in `assignments`. Defaults
   * to `'control'`. Pass a function for per-experiment defaults.
   */
  readonly defaultVariant?: string | ((experimentId: string) => string);
  readonly children: ReactNode;
}

/**
 * Provider that exposes experiment assignments to `<ABTest>`, `<ABVariant>`,
 * and `useABTest`. Resolve the assignments upstream — Vercel `flags`,
 * GrowthBook, LaunchDarkly, your own header — and pass the resolved map.
 */
export function ABProvider({
  assignments,
  defaultVariant = DEFAULT_VARIANT,
  children,
}: ABProviderProps): ReactElement {
  const value = useMemo<ABContextValue>(
    () => ({
      assignments,
      defaultVariant: typeof defaultVariant === 'function' ? defaultVariant : () => defaultVariant,
    }),
    [assignments, defaultVariant],
  );
  return <ABContext.Provider value={value}>{children}</ABContext.Provider>;
}

export function useABContext(): ABContextValue {
  return useContext(ABContext);
}

/**
 * Read the active variant for an experiment. Returns the default variant
 * (typically `'control'`) when the provider doesn't have an assignment.
 */
export function useABTest(experimentId: string): string {
  const { assignments, defaultVariant } = useABContext();
  return assignments[experimentId] ?? defaultVariant(experimentId);
}

export interface ABTestProps {
  readonly name: string;
  readonly children: ReactNode;
}

/**
 * Render the matching `<ABVariant>` for the active assignment. Falls back
 * to the variant whose `id` matches the provider's default (typically
 * `control`); if no fallback variant exists, renders nothing.
 */
export function ABTest({ name, children }: ABTestProps): ReactNode {
  const active = useABTest(name);
  const { defaultVariant } = useABContext();
  const fallback = defaultVariant(name);

  let activeNode: ReactNode = null;
  let fallbackNode: ReactNode = null;

  for (const child of Children.toArray(children)) {
    if (!isVariantElement(child)) continue;
    if (child.props.id === active) activeNode = child;
    if (child.props.id === fallback) fallbackNode = child;
  }
  return activeNode ?? fallbackNode ?? null;
}

export interface ABVariantProps {
  readonly id: string;
  readonly children: ReactNode;
}

/**
 * One arm of an `<ABTest>`. Rendered only when its `id` matches the active
 * assignment for the surrounding `<ABTest name>`.
 */
export function ABVariant({ children }: ABVariantProps): ReactNode {
  return children;
}
ABVariant.displayName = 'ABVariant';

function isVariantElement(node: ReactNode): node is ReactElement<ABVariantProps> {
  if (!isValidElement(node)) return false;
  const type = node.type as { displayName?: string };
  return type === ABVariant || type?.displayName === 'ABVariant';
}
