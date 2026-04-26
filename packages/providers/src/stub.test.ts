import type { StructuredMessage } from '@autotranslate/core';
import { describe, expect, it } from 'vitest';
import { createStubProvider } from './stub';

describe('createStubProvider', () => {
  it('echoes plain string sources', async () => {
    const provider = createStubProvider();
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [
        { key: 'Sign out', source: 'Sign out' },
        { key: 'greeting', source: 'Hello, {name}!' },
      ],
    });
    expect(result.translations['Sign out']).toBe('Sign out');
    expect(result.translations.greeting).toBe('Hello, {name}!');
  });

  it('echoes structured trees', async () => {
    const provider = createStubProvider();
    const tree: StructuredMessage = [{ type: 'text', value: 'hi' }];
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 't.abc123', source: tree }],
    });
    expect(result.translations['t.abc123']).toEqual(tree);
  });

  it('pseudo-localizes when configured', async () => {
    const provider = createStubProvider({ pseudo: true });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'Sign out', source: 'Sign out' }],
    });
    expect(result.translations['Sign out']).toBe('⟦ Šíǵñ óúţ ⟧');
  });

  it('reflects pseudo flag in the cache signature', () => {
    expect(createStubProvider().signature).toBe('stub');
    expect(createStubProvider({ pseudo: true }).signature).toBe('stub:pseudo');
  });

  it('handles an empty batch', async () => {
    const provider = createStubProvider();
    const result = await provider.translate({ source: 'en', target: 'es', items: [] });
    expect(result.translations).toEqual({});
  });
});
