import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock node:module so we can intercept the createRequire-based lazy require.
// Since _require = createRequire(import.meta.url) runs at module init time,
// vi.mock (hoisted) ensures the mock is in place before the auto-loader module loads.

const mockTransformAutoWrap = vi.fn(
  (source: string, { filename }: { filename: string }): { code: string; changed: boolean } => ({
    code: `/* auto-wrapped: ${filename} */\n${source}`,
    changed: true,
  }),
);

const mockCliTransform = { transformAutoWrap: mockTransformAutoWrap };
const mockRequire = vi.fn(() => mockCliTransform);

vi.mock('node:module', () => ({
  createRequire: vi.fn(() => mockRequire),
}));

describe('auto-loader', () => {
  let loaderDefault: (this: { resourcePath: string }, source: string) => string;

  beforeEach(async () => {
    vi.resetModules();
    mockTransformAutoWrap.mockClear();
    mockRequire.mockClear();

    // Re-import so createRequire is called fresh with the mock in place.
    const mod = await import('./auto-loader');
    loaderDefault = mod.default;
  });

  it('exports a default function', () => {
    expect(typeof loaderDefault).toBe('function');
  });

  it('requires @autotranslate/cli/transform via the created require function', () => {
    const context = { resourcePath: '/project/src/App.tsx' };
    loaderDefault.call(context, '<div>Hello</div>');
    expect(mockRequire).toHaveBeenCalledWith('@autotranslate/cli/transform');
  });

  it('calls transformAutoWrap with source and resourcePath as filename', () => {
    const context = { resourcePath: '/project/src/App.tsx' };
    const source = '<p>Hello world</p>';
    loaderDefault.call(context, source);

    expect(mockTransformAutoWrap).toHaveBeenCalledWith(source, {
      filename: '/project/src/App.tsx',
    });
  });

  it('returns the transformed code string', () => {
    const context = { resourcePath: '/project/src/Page.jsx' };
    const result = loaderDefault.call(context, '<div>content</div>');

    expect(typeof result).toBe('string');
    expect(result).toContain('/project/src/Page.jsx');
  });

  it('uses different resourcePath values from the webpack context', () => {
    const context1 = { resourcePath: '/a/Component.tsx' };
    const context2 = { resourcePath: '/b/Layout.jsx' };

    loaderDefault.call(context1, 'source1');
    loaderDefault.call(context2, 'source2');

    expect(mockTransformAutoWrap).toHaveBeenNthCalledWith(1, 'source1', {
      filename: '/a/Component.tsx',
    });
    expect(mockTransformAutoWrap).toHaveBeenNthCalledWith(2, 'source2', {
      filename: '/b/Layout.jsx',
    });
  });
});
