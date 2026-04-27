import { describe, expect, it, vi } from 'vitest';
import { createDeepLProvider } from './deepl';
import type { FetchLike, FetchResponse } from './fetch';

function mockResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): FetchResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => text,
  };
}

function mockFetch(body: unknown, init: { status?: number } = {}): FetchLike {
  return vi.fn(async () => mockResponse(body, init)) as unknown as FetchLike;
}

describe('createDeepLProvider', () => {
  it('shields placeholders, calls DeepL, restores placeholders', async () => {
    const fetch = mockFetch({
      translations: [{ text: 'Hola, [[ATPH:0]]!' }, { text: 'Cerrar sesión' }],
    });
    const provider = createDeepLProvider({ apiKey: 'k', fetch });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [
        { key: 'g', source: 'Hello, {name}!' },
        { key: 's', source: 'Sign out' },
      ],
    });
    expect(result.translations).toEqual({ g: 'Hola, {name}!', s: 'Cerrar sesión' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const calls = (
      fetch as unknown as {
        mock: { calls: [string, { headers: Record<string, string>; body: string }][] };
      }
    ).mock.calls;
    const [url, init] = calls[0]!;
    expect(url).toContain('/translate');
    expect(init.headers.Authorization).toBe('DeepL-Auth-Key k');
    const body = JSON.parse(init.body) as { text: string[]; target_lang: string };
    expect(body.text).toEqual(['Hello, [[ATPH:0]]!', 'Sign out']);
    expect(body.target_lang).toBe('ES');
  });

  it('maps regional locales to DeepL codes', async () => {
    const fetch = mockFetch({ translations: [{ text: 'olá' }] });
    const provider = createDeepLProvider({ apiKey: 'k', fetch });
    await provider.translate({
      source: 'en',
      target: 'pt-BR',
      items: [{ key: 'h', source: 'hello' }],
    });
    const calls = (fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock
      .calls;
    const init = calls[0]![1];
    const body = JSON.parse(init.body) as { target_lang: string };
    expect(body.target_lang).toBe('PT-BR');
  });

  it('throws on structured-tree entries', async () => {
    const provider = createDeepLProvider({ apiKey: 'k', fetch: mockFetch({}) });
    await expect(
      provider.translate({
        source: 'en',
        target: 'es',
        items: [{ key: 't.abc', source: [{ type: 'text', value: 'hi' }] }],
      }),
    ).rejects.toThrow(/structured tree/);
  });

  it('surfaces API error status with body excerpt', async () => {
    const fetch = vi.fn(async () =>
      mockResponse('quota exceeded', { status: 456, statusText: 'Quota Exceeded' }),
    ) as unknown as FetchLike;
    const provider = createDeepLProvider({ apiKey: 'k', fetch });
    await expect(
      provider.translate({
        source: 'en',
        target: 'es',
        items: [{ key: 'h', source: 'hi' }],
      }),
    ).rejects.toThrow(/456 Quota Exceeded.*quota exceeded/);
  });

  it('returns empty result for empty items', async () => {
    const provider = createDeepLProvider({ apiKey: 'k', fetch: mockFetch({}) });
    const r = await provider.translate({ source: 'en', target: 'es', items: [] });
    expect(r.translations).toEqual({});
  });

  it('throws when apiKey is missing', () => {
    expect(() => createDeepLProvider({ apiKey: '', fetch: mockFetch({}) })).toThrow(/apiKey/);
  });
});
