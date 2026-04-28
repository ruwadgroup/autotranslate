import type { Translator, TranslatorOptions } from '@autotranslate/core';
import { createTranslator } from '@autotranslate/core';
import { currentTranslator } from '@autotranslate/core/standalone';
import type * as core from 'zod/v4/core';
import { issueToLookup } from './issues';

export type ZodErrorMap = core.$ZodErrorMap;

export type CreateZodErrorMapInput = Translator | TranslatorOptions;

/** Build an error map bound to a specific translator (or `TranslatorOptions`). */
export function createZodErrorMap(input: CreateZodErrorMapInput): ZodErrorMap {
  const translator = isTranslator(input) ? input : createTranslator(input);
  return (issue) => translateIssue(translator, issue);
}

/** Ambient error map. Reads the active translator at error-map call time. */
export const zodErrorMap: ZodErrorMap = (issue) => {
  return translateIssue(currentTranslator('zodErrorMap'), issue);
};

function translateIssue(
  translator: Translator,
  issue: core.$ZodRawIssue,
): { message: string } | undefined {
  const lookup = issueToLookup(issue);
  if (!lookup) return undefined;
  const raw = translator.raw(lookup.key);
  if (raw === undefined) return undefined;
  return { message: translator.t(lookup.key, lookup.params) };
}

function isTranslator(input: CreateZodErrorMapInput): input is Translator {
  return (
    typeof input === 'object' &&
    input !== null &&
    'raw' in input &&
    typeof (input as Translator).t === 'function'
  );
}

export type { IssueLookup } from './issues';
export { issueToLookup } from './issues';
