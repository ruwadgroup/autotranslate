import { describe, expect, it } from 'vitest';
import { createHybridProvider } from './hybrid';
import { defineProvider } from './types';

const ai = defineProvider({
  name: 'ai-mock',
  signature: 'ai-mock:v1',
  async translate(request) {
    const translations: Record<string, string> = {};
    for (const item of request.items) translations[item.key] = `ai:${item.key}`;
    return { translations };
  },
});

const plain = defineProvider({
  name: 'plain-mock',
  signature: 'plain-mock:v1',
  async translate(request) {
    const translations: Record<string, string> = {};
    for (const item of request.items) translations[item.key] = `plain:${item.key}`;
    return { translations };
  },
});

describe('createHybridProvider', () => {
  it('routes structured trees to ai and strings to plain', async () => {
    const hybrid = createHybridProvider({ ai, plain });
    const result = await hybrid.translate({
      source: 'en',
      target: 'fr',
      items: [
        { key: 'string1', source: 'Hello' },
        { key: 'tree1', source: [{ type: 'text', value: 'Hi' }] },
        { key: 'string2', source: 'World' },
      ],
    });
    expect(result.translations).toEqual({
      string1: 'plain:string1',
      string2: 'plain:string2',
      tree1: 'ai:tree1',
    });
  });

  it('skips a sub-call when one side is empty', async () => {
    let aiCalls = 0;
    let plainCalls = 0;
    const trackedAi = defineProvider({
      ...ai,
      async translate(req) {
        aiCalls += 1;
        return ai.translate(req);
      },
    });
    const trackedPlain = defineProvider({
      ...plain,
      async translate(req) {
        plainCalls += 1;
        return plain.translate(req);
      },
    });
    const hybrid = createHybridProvider({ ai: trackedAi, plain: trackedPlain });
    await hybrid.translate({
      source: 'en',
      target: 'fr',
      items: [{ key: 's', source: 'Plain only' }],
    });
    expect(aiCalls).toBe(0);
    expect(plainCalls).toBe(1);
  });

  it('combines provider signatures', () => {
    const hybrid = createHybridProvider({ ai, plain });
    expect(hybrid.signature).toBe('hybrid:ai-mock:v1+plain-mock:v1');
  });

  it('handles empty items', async () => {
    const hybrid = createHybridProvider({ ai, plain });
    const result = await hybrid.translate({ source: 'en', target: 'fr', items: [] });
    expect(result.translations).toEqual({});
  });
});
