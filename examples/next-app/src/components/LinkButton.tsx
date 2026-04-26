import type { ReactNode } from 'react';

interface LinkButtonProps {
  readonly href: string;
  readonly variant?: 'primary' | 'secondary';
  readonly children: ReactNode;
}

const VARIANTS: Readonly<Record<NonNullable<LinkButtonProps['variant']>, string>> = {
  primary:
    'bg-zinc-900 text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
  secondary:
    'border border-zinc-300 text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900',
};

export default function LinkButton({ href, variant = 'secondary', children }: LinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-colors ${VARIANTS[variant]}`}
    >
      {children}
    </a>
  );
}
