import type { ReactNode } from 'react';

interface LinkButtonProps {
  readonly href: string;
  readonly variant?: 'primary' | 'secondary';
  readonly children: ReactNode;
}

export default function LinkButton({ href, variant = 'secondary', children }: LinkButtonProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`btn btn--${variant}`}>
      {children}
    </a>
  );
}
