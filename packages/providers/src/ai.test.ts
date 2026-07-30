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
    // Answer every requested key so no repair pass is triggered.
    mockGenerate.mockImplementation((args: { prompt: string }) => ({
      object: {
        translations: [...args.prompt.matchAll(/"key":"(k\d+)"/g)].map((m) => ({
          key: m[1],
          icu: `t:${m[1]}`,
        })),
      },
    }));
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      maxBatchSize: 2,
      resolveModel: async () => ({ provider: 'mock' }),
    });
    const items = Array.from({ length: 5 }, (_, i) => ({
      key: `k${i}`,
      source: `s${i}`,
    }));
    const result = await provider.translate({ source: 'en', target: 'es', items });
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(Object.keys(result.translations)).toHaveLength(5);
  });

  it('re-asks for keys the model omitted, in smaller slices', async () => {
    // First pass answers only k0; the repair passes must recover k1 and k2.
    mockGenerate.mockImplementation((args: { prompt: string }) => {
      const keys = [...args.prompt.matchAll(/"key":"(k\d+)"/g)].map((m) => m[1] as string);
      const answered = keys.length > 1 ? keys.slice(0, 1) : keys;
      return { object: { translations: answered.map((k) => ({ key: k, icu: `t:${k}` })) } };
    });
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
      sleep: async () => undefined,
    });
    const items = Array.from({ length: 3 }, (_, i) => ({ key: `k${i}`, source: `s${i}` }));
    const result = await provider.translate({ source: 'en', target: 'es', items });
    expect(Object.keys(result.translations).sort()).toEqual(['k0', 'k1', 'k2']);
  });

  it('retries transient failures with backoff', async () => {
    const delays: number[] = [];
    mockGenerate
      .mockRejectedValueOnce(new Error('529 overloaded'))
      .mockRejectedValueOnce(new Error('529 overloaded'))
      .mockResolvedValueOnce({ object: { translations: [{ key: 'k0', icu: 'hola' }] } });
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'k0', source: 'hello' }],
    });
    expect(result.translations.k0).toBe('hola');
    expect(delays).toEqual([500, 1000]);
  });

  it('gives up after maxRetries and surfaces the error', async () => {
    mockGenerate.mockRejectedValue(new Error('503 unavailable'));
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
      maxRetries: 2,
      sleep: async () => undefined,
    });
    await expect(
      provider.translate({ source: 'en', target: 'es', items: [{ key: 'k0', source: 'hi' }] }),
    ).rejects.toThrow('503 unavailable');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('does not retry aborts', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mockGenerate.mockRejectedValue(abortError);
    const provider = createAIProvider({
      model: 'anthropic:claude-haiku-4-5',
      resolveModel: async () => ({ provider: 'mock' }),
      sleep: async () => undefined,
    });
    await expect(
      provider.translate({ source: 'en', target: 'es', items: [{ key: 'k0', source: 'hi' }] }),
    ).rejects.toThrow('aborted');
    expect(mockGenerate).toHaveBeenCalledTimes(1);
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
