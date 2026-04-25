import { describe, expect, it } from 'vitest';
import {
  type AutotranslateConfigInput,
  defineConfig,
  parseConfig,
  safeParseConfig,
} from './config';

describe('defineConfig', () => {
  it('returns the input unchanged', () => {
    const input = {
      targets: ['es', 'fr'],
      content: ['src/**/*.tsx'],
    } as const satisfies AutotranslateConfigInput;
    expect(defineConfig(input)).toBe(input);
  });

  it('preserves literal target tuples for downstream typing', () => {
    const config = defineConfig({
      targets: ['es', 'fr'],
      content: ['src/**/*.tsx'],
    } as const);
    // type-level assertion: targets stays a literal tuple
    const _check: readonly ['es', 'fr'] = config.targets;
    expect(_check).toEqual(['es', 'fr']);
  });
});

describe('parseConfig', () => {
  it('applies defaults', () => {
    const cfg = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
    });
    expect(cfg.source).toBe('en');
    expect(cfg.outDir).toBe('.translations');
    expect(cfg.concurrency).toBe(8);
    expect(cfg.provider).toEqual({ name: 'stub' });
  });

  it('rejects an empty targets array', () => {
    expect(() => parseConfig({ targets: [], content: ['src/**'] })).toThrow();
  });

  it('rejects an empty content array', () => {
    expect(() => parseConfig({ targets: ['es'], content: [] })).toThrow();
  });

  it('rejects unknown locale tags', () => {
    expect(() => parseConfig({ targets: ['!?'], content: ['src/**'] })).toThrow();
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(() => parseConfig({ targets: ['es'], content: ['src/**'], unknown: true })).toThrow();
  });

  it('rejects ai provider without a model', () => {
    expect(() =>
      parseConfig({
        targets: ['es'],
        content: ['src/**'],
        provider: { name: 'ai' },
      }),
    ).toThrow();
  });

  it('accepts a fully-specified ai provider', () => {
    const cfg = parseConfig({
      targets: ['es'],
      content: ['src/**'],
      provider: { name: 'ai', model: 'anthropic:claude-haiku-4-5' },
    });
    expect(cfg.provider).toEqual({
      name: 'ai',
      model: 'anthropic:claude-haiku-4-5',
    });
  });

  it('accepts the stub provider with pseudo flag', () => {
    const cfg = parseConfig({
      targets: ['es'],
      content: ['src/**'],
      provider: { name: 'stub', pseudo: true },
    });
    expect(cfg.provider).toEqual({ name: 'stub', pseudo: true });
  });

  it('caps concurrency at 64', () => {
    expect(() => parseConfig({ targets: ['es'], content: ['src/**'], concurrency: 65 })).toThrow();
  });
});

describe('safeParseConfig', () => {
  it('returns success on valid input', () => {
    const result = safeParseConfig({ targets: ['es'], content: ['src/**'] });
    expect(result.success).toBe(true);
  });

  it('returns failure with errors on invalid input', () => {
    const result = safeParseConfig({});
    expect(result.success).toBe(false);
  });
});
