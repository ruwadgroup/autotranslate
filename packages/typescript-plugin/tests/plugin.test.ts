import { describe, expect, it } from 'vitest';
import factory from '../dist/index.js';

describe('@autotranslate/typescript-plugin', () => {
  it('exports a tsserver plugin factory', () => {
    expect(typeof factory).toBe('function');
  });

  it('factory returns a plugin module with a `create` hook', () => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal stub
    const plugin = (factory as any)({ typescript: {} });
    expect(plugin).toHaveProperty('create');
    expect(typeof plugin.create).toBe('function');
  });
});
