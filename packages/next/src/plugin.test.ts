import { describe, expect, it } from 'vitest';
import { withAutotranslate } from './plugin';

describe('withAutotranslate', () => {
  it('adds the default catalog directory to outputFileTracingIncludes', () => {
    const result = withAutotranslate({ reactStrictMode: true });
    expect(result.outputFileTracingIncludes?.['/**/*']).toEqual(['./.translations/**/*']);
    expect(result.reactStrictMode).toBe(true);
  });

  it('honours a custom outDir', () => {
    const result = withAutotranslate({}, { outDir: 'public/i18n' });
    expect(result.outputFileTracingIncludes?.['/**/*']).toEqual(['./public/i18n/**/*']);
  });

  it('merges with existing outputFileTracingIncludes', () => {
    const result = withAutotranslate({
      outputFileTracingIncludes: {
        '/**/*': ['./existing/**/*'],
        '/api/*': ['./tracking/**/*'],
      },
    });
    expect(result.outputFileTracingIncludes?.['/**/*']).toEqual([
      './existing/**/*',
      './.translations/**/*',
    ]);
    expect(result.outputFileTracingIncludes?.['/api/*']).toEqual(['./tracking/**/*']);
  });

  it('is idempotent — re-applying the wrapper does not duplicate entries', () => {
    const once = withAutotranslate({ reactStrictMode: true });
    const twice = withAutotranslate(once);
    expect(twice.outputFileTracingIncludes?.['/**/*']).toEqual(['./.translations/**/*']);
  });

  it('returns the config untouched when traceIncludes is disabled', () => {
    const result = withAutotranslate({ reactStrictMode: true }, { traceIncludes: false });
    expect(result.outputFileTracingIncludes).toBeUndefined();
  });
});
