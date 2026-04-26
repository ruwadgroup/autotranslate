import { describe, expect, it, vi } from 'vitest';
import { createGoogleProvider } from './google';

function mockFetch(body: unknown, init: { status?: number } = {}): typeof globalThis.fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch;
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
    const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    expect(url).toContain('translation.googleapis.com');
    expect(url).toContain('key=k');
    const body = JSON.parse(init.body as string) as {
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
    const fetch = vi.fn(
      async () => new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }),
    ) as unknown as typeof globalThis.fetch;
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
