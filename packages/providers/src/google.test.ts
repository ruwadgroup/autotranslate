import { describe, expect, it, vi } from 'vitest';
import type { FetchLike, FetchResponse } from './fetch';
import { createGoogleProvider } from './google';

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

describe('createGoogleProvider', () => {
  it('shields placeholders, calls Google, restores placeholders', async () => {
    const fetch = mockFetch({
      data: { translations: [{ translatedText: 'Hola, [[ATPH:0]]!' }] },
    });
    const provider = createGoogleProvider({ apiKey: 'k', fetch });
    const result = await provider.translate({
      source: 'en',
      target: 'es',
      items: [{ key: 'g', source: 'Hello, {name}!' }],
    });
    expect(result.translations).toEqual({ g: 'Hola, {name}!' });
    const calls = (fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock
      .calls;
    const [url, init] = calls[0]!;
    expect(url).toContain('translation.googleapis.com');
    expect(url).toContain('key=k');
    const body = JSON.parse(init.body) as {
      q: string[];
      target: string;
      format: string;
    };
    expect(body.q).toEqual(['Hello, [[ATPH:0]]!']);
    expect(body.target).toBe('es');
    expect(body.format).toBe('text');
  });

  it('throws on structured-tree entries', async () => {
    const provider = createGoogleProvider({ apiKey: 'k', fetch: mockFetch({}) });
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
      mockResponse('rate limited', { status: 429, statusText: 'Too Many Requests' }),
    ) as unknown as FetchLike;
    const provider = createGoogleProvider({ apiKey: 'k', fetch });
    await expect(
      provider.translate({
        source: 'en',
        target: 'es',
        items: [{ key: 'h', source: 'hi' }],
      }),
    ).rejects.toThrow(/429 Too Many Requests.*rate limited/);
  });

  it('throws when apiKey is missing', () => {
    expect(() => createGoogleProvider({ apiKey: '' })).toThrow(/apiKey/);
  });
});
