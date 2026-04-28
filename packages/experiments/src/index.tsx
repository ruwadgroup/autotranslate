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

/** Map of experiment id → active variant id. */
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
  readonly assignments: ExperimentAssignments;
  /** Default when an experiment isn't in `assignments`. Defaults to `'control'`. */
  readonly defaultVariant?: string | ((experimentId: string) => string);
  readonly children: ReactNode;
}

/** Exposes experiment assignments to `<Experiment>`, `<Variant>`, and `useExperiment`. */
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

/** Read the active variant for an experiment. */
export function useExperiment(experimentId: string): string {
  const { assignments, defaultVariant } = useExperimentContext();
  return assignments[experimentId] ?? defaultVariant(experimentId);
}

export interface ExperimentProps {
  readonly name: string;
  readonly children: ReactNode;
}

/** Render the matching `<Variant>`. Falls back to the default variant or `null`. */
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

/** One arm of an `<Experiment>`. */
export function Variant({ children }: VariantProps): ReactNode {
  return children;
}
Variant.displayName = 'Variant';

function isVariantElement(node: ReactNode): node is ReactElement<VariantProps> {
  if (!isValidElement(node)) return false;
  const type = node.type as { displayName?: string };
  return type === Variant || type?.displayName === 'Variant';
}
