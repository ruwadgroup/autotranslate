import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Experiment, ExperimentProvider, useExperiment, Variant } from './index';

function Probe({ id }: { id: string }) {
  const variant = useExperiment(id);
  return <span>{variant}</span>;
}

describe('useExperiment', () => {
  it('returns the active assignment for an experiment', () => {
    render(
      <ExperimentProvider assignments={{ cta: 'urgent' }}>
        <Probe id="cta" />
      </ExperimentProvider>,
    );
    expect(screen.getByText('urgent')).toBeTruthy();
  });

  it('falls back to the default variant when missing', () => {
    render(
      <ExperimentProvider assignments={{}}>
        <Probe id="cta" />
      </ExperimentProvider>,
    );
    expect(screen.getByText('control')).toBeTruthy();
  });

  it('honors a function default', () => {
    render(
      <ExperimentProvider
        assignments={{}}
        defaultVariant={(name) => (name === 'cta' ? 'baseline' : 'control')}
      >
        <Probe id="cta" />
      </ExperimentProvider>,
    );
    expect(screen.getByText('baseline')).toBeTruthy();
  });
});

describe('Experiment / Variant', () => {
  it('renders the matching variant', () => {
    render(
      <ExperimentProvider assignments={{ hero: 'b' }}>
        <Experiment name="hero">
          <Variant id="control">Original</Variant>
          <Variant id="b">Treatment</Variant>
        </Experiment>
      </ExperimentProvider>,
    );
    expect(screen.queryByText('Original')).toBeNull();
    expect(screen.getByText('Treatment')).toBeTruthy();
  });

  it('falls back to the control variant when assignment is missing', () => {
    render(
      <ExperimentProvider assignments={{}}>
        <Experiment name="hero">
          <Variant id="control">Original</Variant>
          <Variant id="b">Treatment</Variant>
        </Experiment>
      </ExperimentProvider>,
    );
    expect(screen.getByText('Original')).toBeTruthy();
  });

  it('renders nothing when no fallback variant is declared', () => {
    const { container } = render(
      <ExperimentProvider assignments={{}}>
        <Experiment name="hero">
          <Variant id="b">Treatment</Variant>
        </Experiment>
      </ExperimentProvider>,
    );
    expect(container.textContent).toBe('');
  });
});
