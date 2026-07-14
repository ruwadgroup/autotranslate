import { describe, expect, it } from 'vitest';

describe('@autotranslate/zod/source', () => {
  it('can be imported without an active translator', async () => {
    const source = await import('./source');

    expect(source.collectZodSourceKeys).toBeTypeOf('function');
  });
});
