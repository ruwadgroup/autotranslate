import { buildCatalog, createTranslator } from '@autotranslate/core';
import { withTranslator } from '@autotranslate/core/standalone';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import enFallbackRaw from './catalog/en.json' with { type: 'json' };
import { createZodErrorMap, zodErrorMap } from './index';

// The shipped en.json is keyed by literal `zod.*` codes for human review;
// hash it once for the runtime catalog shape.
const enFallback = buildCatalog(enFallbackRaw as Record<string, string>);

const userCatalog = buildCatalog({
  'zod.invalid_type': 'Type invalide : {expected} attendu, {received} reçu',
  'zod.too_small.string':
    '{minimum, plural, =1 {Doit contenir au moins 1 caractère} other {Doit contenir au moins # caractères}}',
});

describe('createZodErrorMap', () => {
  it('translates known issues via the bound translator', () => {
    const errorMap = createZodErrorMap({
      locale: 'fr',
      catalog: userCatalog,
      fallback: enFallback,
    });
    z.config({ customError: errorMap });

    const r = z.string().safeParse(42);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('Type invalide : string attendu, number reçu');
    }
  });

  it('falls back to bundled en catalog when user catalog is missing the key', () => {
    const errorMap = createZodErrorMap({ locale: 'fr', catalog: {}, fallback: enFallback });
    z.config({ customError: errorMap });

    const r = z.string().min(3).safeParse('a');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain('at least 3 characters');
    }
  });

  it('returns undefined for codes it does not handle, letting zod locales chain', () => {
    const errorMap = createZodErrorMap({ locale: 'en', catalog: {}, fallback: enFallback });
    z.config({ customError: errorMap, localeError: z.locales.fr().localeError });

    const r = z.union([z.string(), z.number()]).safeParse(true);
    expect(r.success).toBe(false);
  });

  it('accepts an existing Translator', () => {
    const translator = createTranslator({
      locale: 'fr',
      catalog: userCatalog,
      fallback: enFallback,
    });
    const errorMap = createZodErrorMap(translator);
    z.config({ customError: errorMap });

    const r = z.string().min(2).safeParse('a');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('Doit contenir au moins 2 caractères');
    }
  });
});

describe('zodErrorMap (ambient)', () => {
  it('reads the active translator at error-map call time', () => {
    z.config({ customError: zodErrorMap });
    const translator = createTranslator({
      locale: 'fr',
      catalog: userCatalog,
      fallback: enFallback,
    });
    withTranslator(translator, () => {
      const r = z.string().min(3).safeParse('a');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0]?.message).toBe('Doit contenir au moins 3 caractères');
      }
    });
  });
});
