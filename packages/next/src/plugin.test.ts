import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock state - the vi.mock factory closure reads these at call time.
// We pair vi.resetModules() + vi.doMock() in beforeEach so the factory runs
// fresh for every test.

const mockCreateDevLoop = vi.fn();
const mockLoadConfig = vi.fn();
const mockCheckFrozen = vi.fn();
const mockFormatFrozenReport = vi.fn();
const mockTranslate = vi.fn();

// Symbol keys used by the singleton guard (must match plugin.ts).
const DEV_LOOP_KEY = Symbol.for('autotranslate.devLoop');
const CLI_WARN_KEY = Symbol.for('autotranslate.cliWarn');

function clearSingletons() {
  delete (globalThis as unknown as Record<symbol, unknown>)[DEV_LOOP_KEY];
  delete (globalThis as unknown as Record<symbol, unknown>)[CLI_WARN_KEY];
}

function makeExplicitConfig() {
  return {
    cwd: '/project',
    config: { mode: 'explicit' as const, build: { frozen: true, translateOnBuild: false } },
    outDir: '/project/.translations',
  };
}

function makeAutoConfig() {
  return {
    cwd: '/project',
    config: { mode: 'auto' as const, build: { frozen: true, translateOnBuild: false } },
    outDir: '/project/.translations',
  };
}

// We use vi.doMock + vi.resetModules so the factory is re-evaluated per test,
// giving us independent mock state and allowing us to swap to a throwing factory.
beforeEach(() => {
  clearSingletons();
  vi.resetModules();

  mockCreateDevLoop.mockReset();
  mockLoadConfig.mockReset();
  mockCheckFrozen.mockReset();
  mockFormatFrozenReport.mockReset();
  mockTranslate.mockReset();

  mockCreateDevLoop.mockReturnValue({ close: vi.fn().mockResolvedValue(undefined) });
  mockLoadConfig.mockResolvedValue(makeExplicitConfig());
  mockCheckFrozen.mockResolvedValue({
    ok: true,
    catalogAbsent: false,
    missingSource: [],
    problems: [],
  });
  mockFormatFrozenReport.mockReturnValue('FROZEN: key "foo" missing at src/app.tsx:12');
  mockTranslate.mockResolvedValue({ stats: {} });

  vi.doMock('@autotranslate/cli', () => ({
    createDevLoop: mockCreateDevLoop,
    loadConfig: mockLoadConfig,
    checkFrozen: mockCheckFrozen,
    formatFrozenReport: mockFormatFrozenReport,
    translate: mockTranslate,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withAutotranslate', () => {
  it('returns an async function (not a config object)', async () => {
    const { withAutotranslate } = await import('./plugin');
    const result = withAutotranslate({ reactStrictMode: true });
    expect(typeof result).toBe('function');
  });

  it('the returned function resolves to a config object', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate({ reactStrictMode: true });
    const config = await fn('phase-development-server', {});
    expect(config).toMatchObject({ reactStrictMode: true });
  });
});

describe('dev phase', () => {
  it('starts the dev loop on phase-development-server', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-development-server', {});
    expect(mockCreateDevLoop).toHaveBeenCalledOnce();
  });

  it('starts the loop exactly once across two invocations (singleton guard)', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-development-server', {});
    await fn('phase-development-server', {});
    expect(mockCreateDevLoop).toHaveBeenCalledOnce();
  });

  it('does not start the loop when devLoop is false', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate({}, { devLoop: false });
    await fn('phase-development-server', {});
    expect(mockCreateDevLoop).not.toHaveBeenCalled();
  });

  it('does not start the loop on a non-dev phase', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-production-build', {});
    expect(mockCreateDevLoop).not.toHaveBeenCalled();
  });

  it('passes cwd and onEvent to createDevLoop', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-development-server', {});
    const [opts] = mockCreateDevLoop.mock.calls[0]!;
    expect(opts).toHaveProperty('cwd');
    expect(typeof opts.onEvent).toBe('function');
  });

  it('onEvent logs errors via console.warn with autotranslate prefix', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-development-server', {});

    const [{ onEvent }] = mockCreateDevLoop.mock.calls[0]!;
    onEvent({ type: 'error', error: new Error('boom') });

    expect(warnSpy).toHaveBeenCalledWith('[autotranslate]', expect.any(Error));
  });

  it('onEvent logs run-complete counts via console.log', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-development-server', {});

    const [{ onEvent }] = mockCreateDevLoop.mock.calls[0]!;
    onEvent({ type: 'run-complete', extract: { fileCount: 3 }, translated: true });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[autotranslate] run complete: 3 files extracted, translated: true'),
    );
  });
});

describe('build phase', () => {
  it('runs checkFrozen on phase-production-build', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await fn('phase-production-build', {});
    expect(mockCheckFrozen).toHaveBeenCalledOnce();
  });

  it('throws with the formatted report when frozen check fails', async () => {
    mockCheckFrozen.mockResolvedValue({
      ok: false,
      catalogAbsent: false,
      missingSource: [{ key: 'foo', text: 'Hello', occurrence: 'src/app.tsx:12' }],
      problems: [],
    });
    mockFormatFrozenReport.mockReturnValue('FROZEN: key "foo" missing at src/app.tsx:12');

    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await expect(fn('phase-production-build', {})).rejects.toThrow(
      'FROZEN: key "foo" missing at src/app.tsx:12',
    );
  });

  it('does not throw when catalogAbsent is true (fresh project grace)', async () => {
    mockCheckFrozen.mockResolvedValue({
      ok: false,
      catalogAbsent: true,
      missingSource: [],
      problems: [],
    });
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await expect(fn('phase-production-build', {})).resolves.toBeDefined();
    expect(mockFormatFrozenReport).not.toHaveBeenCalled();
  });

  it('translateOnBuild path: calls translate then re-checks before passing', async () => {
    mockCheckFrozen
      .mockResolvedValueOnce({ ok: false, catalogAbsent: false, missingSource: [], problems: [] })
      .mockResolvedValueOnce({ ok: true, catalogAbsent: false, missingSource: [], problems: [] });

    mockLoadConfig.mockResolvedValue({
      cwd: '/project',
      config: { mode: 'explicit' as const, build: { frozen: true, translateOnBuild: true } },
      outDir: '/project/.translations',
    });

    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await expect(fn('phase-production-build', {})).resolves.toBeDefined();

    expect(mockTranslate).toHaveBeenCalledOnce();
    expect(mockCheckFrozen).toHaveBeenCalledTimes(2);
    expect(mockFormatFrozenReport).not.toHaveBeenCalled();
  });

  it('translateOnBuild path: throws if re-check still fails after translate', async () => {
    mockCheckFrozen.mockResolvedValue({
      ok: false,
      catalogAbsent: false,
      missingSource: [],
      problems: [],
    });
    mockFormatFrozenReport.mockReturnValue('STILL FROZEN after translate');
    mockLoadConfig.mockResolvedValue({
      cwd: '/project',
      config: { mode: 'explicit' as const, build: { frozen: true, translateOnBuild: true } },
      outDir: '/project/.translations',
    });

    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    await expect(fn('phase-production-build', {})).rejects.toThrow('STILL FROZEN after translate');

    expect(mockTranslate).toHaveBeenCalledOnce();
    expect(mockCheckFrozen).toHaveBeenCalledTimes(2);
  });

  it('options.build.frozen=false skips the frozen check', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate({}, { build: { frozen: false } });
    await fn('phase-production-build', {});
    expect(mockCheckFrozen).not.toHaveBeenCalled();
  });

  it('options.build overrides config.build.translateOnBuild', async () => {
    // Config says translateOnBuild=false, options says true.
    mockCheckFrozen
      .mockResolvedValueOnce({ ok: false, catalogAbsent: false, missingSource: [], problems: [] })
      .mockResolvedValueOnce({ ok: true, catalogAbsent: false, missingSource: [], problems: [] });

    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate({}, { build: { translateOnBuild: true } });
    await fn('phase-production-build', {});
    expect(mockTranslate).toHaveBeenCalledOnce();
  });
});

describe('when @autotranslate/cli is not installed', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@autotranslate/cli');
    vi.doMock('@autotranslate/cli', () => {
      throw new Error('Cannot find module');
    });
  });

  it('warns once with an install hint across development and build phases', async () => {
    clearSingletons();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();

    await expect(fn('phase-development-server', {})).resolves.toBeDefined();
    await expect(fn('phase-production-build', {})).resolves.toBeDefined();

    expect(warnSpy).toHaveBeenCalledOnce();
    const warningText = warnSpy.mock.calls[0]!.join(' ');
    expect(warningText).toContain('autotranslate');
    expect(warningText).toContain('pnpm add -D @autotranslate/cli');
    const config = await fn('phase-production-build', {});
    expect(config.webpack).toBeUndefined();
    expect(config.turbopack).toBeUndefined();
  });
});

describe('auto mode', () => {
  beforeEach(() => {
    mockLoadConfig.mockResolvedValue(makeAutoConfig());
  });

  it('injects the webpack rule when mode is auto', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    const config = await fn('phase-production-build', {});

    expect(typeof config.webpack).toBe('function');

    const fakeWebpackConfig = { module: { rules: [] } };
    const result = (config.webpack as (c: unknown, o: unknown) => unknown)(
      fakeWebpackConfig,
      {},
    ) as {
      module: { rules: unknown[] };
    };
    const firstRule = result.module.rules[0] as {
      test: RegExp;
      exclude: RegExp;
      use: Array<{ loader: string }>;
    };
    expect(firstRule.test).toBeInstanceOf(RegExp);
    expect(firstRule.test.test('Component.tsx')).toBe(true);
    expect(firstRule.test.test('Component.jsx')).toBe(true);
    expect(firstRule.test.test('Component.ts')).toBe(false);
    expect(firstRule.exclude.test('node_modules/foo/bar.tsx')).toBe(true);
    expect(firstRule.use[0]!.loader).toBe('@autotranslate/next/auto-loader');
  });

  it('injects turbopack rules for .tsx and .jsx when mode is auto', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    const config = await fn('phase-production-build', {});

    expect(config.turbopack).toBeDefined();
    const rules = (config.turbopack as { rules: Record<string, unknown> }).rules;
    expect(rules['*.tsx']).toEqual({ loaders: ['@autotranslate/next/auto-loader'] });
    expect(rules['*.jsx']).toEqual({ loaders: ['@autotranslate/next/auto-loader'] });
  });

  it('does not inject loaders when mode is explicit', async () => {
    mockLoadConfig.mockResolvedValue(makeExplicitConfig());

    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate();
    const config = await fn('phase-production-build', {});

    expect(config.webpack).toBeUndefined();
    expect(config.turbopack).toBeUndefined();
  });

  it('preserves and composes user-provided webpack function', async () => {
    const userWebpack = vi.fn((cfg: unknown) => {
      const c = cfg as { module: { rules: unknown[] } };
      c.module.rules.push({ test: /\.svg$/, use: ['svg-loader'] });
      return c;
    });

    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate({ webpack: userWebpack });
    const config = await fn('phase-production-build', {});

    const fakeWebpackConfig = { module: { rules: [] as unknown[] } };
    const result = (config.webpack as (c: unknown, o: unknown) => unknown)(
      fakeWebpackConfig,
      {},
    ) as {
      module: { rules: unknown[] };
    };

    expect(userWebpack).toHaveBeenCalledOnce();

    const rules = result.module.rules as Array<{ test?: RegExp; use?: unknown[] }>;
    const hasAutoTranslateRule = rules.some(
      (r) =>
        r.use?.[0] &&
        (r.use[0] as { loader?: string }).loader === '@autotranslate/next/auto-loader',
    );
    const hasSvgRule = rules.some((r) => r.test?.source === '\\.svg$');
    expect(hasAutoTranslateRule).toBe(true);
    expect(hasSvgRule).toBe(true);

    // Autotranslate rule must be first (unshift).
    const firstRule = rules[0] as { use: Array<{ loader: string }> };
    expect(firstRule.use[0]!.loader).toBe('@autotranslate/next/auto-loader');
  });

  it('merges with existing turbopack rules', async () => {
    const { withAutotranslate } = await import('./plugin');
    const fn = withAutotranslate({
      turbopack: { rules: { '*.svg': { loaders: ['svg-loader'] } } },
    });
    const config = await fn('phase-production-build', {});

    const rules = (config.turbopack as { rules: Record<string, unknown> }).rules;
    expect(rules['*.svg']).toEqual({ loaders: ['svg-loader'] });
    expect(rules['*.tsx']).toEqual({ loaders: ['@autotranslate/next/auto-loader'] });
    expect(rules['*.jsx']).toEqual({ loaders: ['@autotranslate/next/auto-loader'] });
  });
});
