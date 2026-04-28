import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABProvider, ABTest, ABVariant, useABTest } from './index';

function Probe({ id }: { id: string }) {
  const variant = useABTest(id);
  return <span>{variant}</span>;
}

describe('useABTest', () => {
  it('returns the active assignment for an experiment', () => {
    render(
      <ABProvider assignments={{ cta: 'urgent' }}>
        <Probe id="cta" />
      </ABProvider>,
    );
    expect(screen.getByText('urgent')).toBeTruthy();
  });

  it('falls back to the default variant when missing', () => {
    render(
      <ABProvider assignments={{}}>
        <Probe id="cta" />
      </ABProvider>,
    );
    expect(screen.getByText('control')).toBeTruthy();
  });

  it('honors a function default', () => {
    render(
      <ABProvider
        assignments={{}}
        defaultVariant={(name) => (name === 'cta' ? 'baseline' : 'control')}
      >
        <Probe id="cta" />
      </ABProvider>,
    );
    expect(screen.getByText('baseline')).toBeTruthy();
  });
});

describe('ABTest / ABVariant', () => {
  it('renders the matching variant', () => {
    render(
      <ABProvider assignments={{ hero: 'b' }}>
        <ABTest name="hero">
          <ABVariant id="control">Original</ABVariant>
          <ABVariant id="b">Treatment</ABVariant>
        </ABTest>
      </ABProvider>,
    );
    expect(screen.queryByText('Original')).toBeNull();
    expect(screen.getByText('Treatment')).toBeTruthy();
  });

  it('falls back to the control variant when assignment is missing', () => {
    render(
      <ABProvider assignments={{}}>
        <ABTest name="hero">
          <ABVariant id="control">Original</ABVariant>
          <ABVariant id="b">Treatment</ABVariant>
        </ABTest>
      </ABProvider>,
    );
    expect(screen.getByText('Original')).toBeTruthy();
  });

  it('renders nothing when no fallback variant is declared', () => {
    const { container } = render(
      <ABProvider assignments={{}}>
        <ABTest name="hero">
          <ABVariant id="b">Treatment</ABVariant>
        </ABTest>
      </ABProvider>,
    );
    expect(container.textContent).toBe('');
  });
});
