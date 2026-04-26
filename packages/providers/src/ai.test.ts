import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAIProvider } from './ai';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

const { generateObject } = await import('ai');
const mockGenerate = generateObject as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGenerate.mockReset();
});

describe('createAIProvider', () => {
  it('returns empty translations for an empty batch', async () => {
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
    });
    const result = await provider.translate({ source: 'en', target: 'es', items: [] });
    expect(result.translations).toEqual({});
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('translates string sources via ICU round-trip', async () => {
    mockGenerate.mockResolvedValueOnce({
      object: {
        translations: [
          { key: 'Sign out', icu: 'Cerrar sesión' },
          { key: 'greeting', icu: 'Hola, {name}!' },
        ],
      },
    });
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
    });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [
        { key: 'Sign out', source: 'Sign out' },
        { key: 'greeting', source: 'Hello, {name}!' },
      ],
    });
    expect(result.translations['Sign out']).toBe('Cerrar sesión');
    expect(result.translations.greeting).toBe('Hola, {name}!');
  });

  it('translates structured trees through ICU and back', async () => {
    mockGenerate.mockResolvedValueOnce({
      object: {
        translations: [{ key: 't.abc', icu: 'Hola, {name}!' }],
      },
    });
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
    });
    const tree = [
      { type: 'text' as const, value: 'Hello, ' },
      { type: 'var' as const, name: 'name' },
      { type: 'text' as const, value: '!' },
    ];
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 't.abc', source: tree }],
    });
    expect(result.translations['t.abc']).toEqual([
      { type: 'text', value: 'Hola, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ]);
  });

  it('batches at maxBatchSize', async () => {
    mockGenerate.mockResolvedValue({ object: { translations: [] } });
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      maxBatchSize: 2,
      resolveModel: async () => ({ provider: 'mock' }),
    });
    const items = Array.from({ length: 5 }, (_, i) => ({
      key: `k${i}`,
      source: `s${i}`,
    }));
    await provider.translate({ source: 'en', target: 'es', items });
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed model strings', async () => {
    const provider = createAIProvider({ model: 'no-colon' });
    await expect(
      provider.translate({
        source: 'en',
        target: 'es',
        items: [{ key: 'k', source: 's' }],
      }),
    ).rejects.toThrow(/<vendor>:<model>/);
  });

  it('signature reflects model and instruction', () => {
    const a = createAIProvider({ model: 'anthropic:claude-haiku-4-5' });
    const b = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      instruction: 'be formal',
    });
    expect(a.signature).toBe('ai:anthropic:claude-haiku-4-5');
    expect(b.signature).not.toBe(a.signature);
    expect(b.signature.startsWith('ai:anthropic:claude-haiku-4-5:')).toBe(true);
  });
});
