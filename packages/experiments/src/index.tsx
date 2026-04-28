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

interface ExperimentContextValue {
  readonly assignments: ExperimentAssignments;
  readonly defaultVariant: (experimentId: string) => string;
}

const DEFAULT_VARIANT = 'control';

const ExperimentContext = createContext<ExperimentContextValue>({
  assignments: {},
  defaultVariant: () => DEFAULT_VARIANT,
});

export interface ExperimentProviderProps {
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
 * Exposes experiment assignments to `<Experiment>`, `<Variant>`, and
 * `useExperiment`. Resolve the assignments upstream — Vercel `flags`,
 * GrowthBook, LaunchDarkly, your own header — and pass the resolved map.
 */
export function ExperimentProvider({
  assignments,
  defaultVariant = DEFAULT_VARIANT,
  children,
}: ExperimentProviderProps): ReactElement {
  const value = useMemo<ExperimentContextValue>(
    () => ({
      assignments,
      defaultVariant: typeof defaultVariant === 'function' ? defaultVariant : () => defaultVariant,
    }),
    [assignments, defaultVariant],
  );
  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>;
}

export function useExperimentContext(): ExperimentContextValue {
  return useContext(ExperimentContext);
}

/**
 * Read the active variant for an experiment. Returns the default (typically
 * `'control'`) when the provider has no assignment for it.
 */
export function useExperiment(experimentId: string): string {
  const { assignments, defaultVariant } = useExperimentContext();
  return assignments[experimentId] ?? defaultVariant(experimentId);
}

export interface ExperimentProps {
  readonly name: string;
  readonly children: ReactNode;
}

/**
 * Render the matching `<Variant>` for the active assignment. Falls back to
 * the variant whose `id` matches the provider's default (typically
 * `'control'`); renders nothing if no fallback variant is declared.
 */
export function Experiment({ name, children }: ExperimentProps): ReactNode {
  const active = useExperiment(name);
  const { defaultVariant } = useExperimentContext();
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

export interface VariantProps {
  readonly id: string;
  readonly children: ReactNode;
}

/**
 * One arm of an `<Experiment>`. Rendered only when its `id` matches the
 * active assignment for the surrounding `<Experiment name>`.
 */
export function Variant({ children }: VariantProps): ReactNode {
  return children;
}
Variant.displayName = 'Variant';

function isVariantElement(node: ReactNode): node is ReactElement<VariantProps> {
  if (!isValidElement(node)) return false;
  const type = node.type as { displayName?: string };
  return type === Variant || type?.displayName === 'Variant';
}
