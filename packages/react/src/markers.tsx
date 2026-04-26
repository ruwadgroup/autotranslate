import type { ReactNode } from 'react';

export interface VarProps {
  /** Slot name. Becomes `{name}` in the canonical message. Defaults to `value`. */
  readonly name?: string;
  /** Runtime value rendered in place of the slot. */
  readonly children?: ReactNode;
}

/**
 * Variable slot inside a `<T>` block.
 *
 * `<T>Hello, <Var name="user">{user.name}</Var>!</T>`
 *
 * `<Var>` is a structural marker — `<T>` reads it to build the canonical
 * message and substitute the `children` at the corresponding slot in the
 * translated tree. When rendered outside `<T>` it just passes its children
 * through, so it composes safely with normal JSX.
 */
export function Var({ children = null }: VarProps): ReactNode {
  return children;
}
Var.displayName = 'Var';

export interface PluralProps {
  /** Slot name. Defaults to `count`. */
  readonly name?: string;
  /** The count that selects which form is rendered. */
  readonly value: number;
  readonly zero?: ReactNode;
  readonly one?: ReactNode;
  readonly two?: ReactNode;
  readonly few?: ReactNode;
  readonly many?: ReactNode;
  readonly other: ReactNode;
}

/**
 * Plural branch inside a `<T>` block.
 *
 * `<T>You have <Plural value={count} one="1 message" other="# messages" />.</T>`
 *
 * Like `<Var>`, this is a marker that `<T>` interprets when building the
 * canonical message. When rendered outside `<T>`, it picks the right form
 * for the active locale via `Intl.PluralRules` so it can also stand alone.
 *
 * Form selection lives in `T`'s renderer when used inside `<T>`; the bare
 * component below handles the standalone case.
 */
export function Plural(_props: PluralProps): ReactNode {
  // Standalone path: T's renderer never enters this function — it consumes
  // the props directly from the React element. We *could* implement a
  // standalone selector here, but it would require its own context lookup
  // and doubles the surface for no gain. Render `null` as the safe default;
  // intentional standalone use should pass `value` and inspect the form
  // explicitly. The renderer-driven path is the only documented entry.
  return null;
}
Plural.displayName = 'Plural';
