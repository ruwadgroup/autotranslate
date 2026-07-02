import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import factory from '../dist/index.js';

function hash12(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12);
}

// Fixture paths. The `translations-basic` tree lives under `tests/fixtures/`.
// We treat `tests/fixtures/` as the project root and `translations-basic` as
// the outDir so the plugin resolves:
//   <projectRoot>/<outDir>/<locale>/**/*.json
const FIXTURES_ROOT = resolve(import.meta.dirname, 'fixtures');
const OUT_DIR = 'translations-basic';
const SOURCE_LOCALE = 'en';

// Known source strings and their hashes (must match fixtures/translations-basic/en/a.json)
const _HELLO_HASH = hash12('hello'); // 2cf24dba5fb0
const _WORLD_HASH = hash12('world'); // 486ea46224d1
const _LONG_HASH = hash12(
  'A very long translation text that should be truncated because it exceeds forty characters',
); // 76fa3939eede

interface VirtualFile {
  name: string;
  content: string;
}

function createPluginLanguageService(
  virtualFile: VirtualFile,
  pluginConfig: Record<string, unknown> = {},
) {
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [virtualFile.name],
    getScriptVersion: () => '0',
    getScriptSnapshot: (f) => {
      if (f === virtualFile.name) return ts.ScriptSnapshot.fromString(virtualFile.content);
      return undefined;
    },
    getCurrentDirectory: () => FIXTURES_ROOT,
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      skipLibCheck: true,
      // noResolve avoids failing on @autotranslate/* imports in the test source.
      noResolve: true,
    }),
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    fileExists: (f) => f === virtualFile.name || ts.sys.fileExists(f),
    readFile: (f) => (f === virtualFile.name ? virtualFile.content : ts.sys.readFile(f)),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const ls = ts.createLanguageService(host);

  const pluginInfo = {
    config: { outDir: OUT_DIR, source: SOURCE_LOCALE, ...pluginConfig },
    project: { getCurrentDirectory: () => FIXTURES_ROOT },
    languageService: ls,
  };

  const pluginFactory = factory as ts.server.PluginModuleFactory;
  const module = pluginFactory({ typescript: ts });
  return module.create(pluginInfo as unknown as ts.server.PluginCreateInfo);
}

function fullSpan(content: string): ts.TextSpan {
  return { start: 0, length: content.length };
}

describe('@autotranslate/typescript-plugin - factory', () => {
  it('exports a tsserver plugin factory', () => {
    expect(typeof factory).toBe('function');
  });

  it('factory returns a plugin module with a `create` hook', () => {
    const pluginFactory = factory as ts.server.PluginModuleFactory;
    const plugin = pluginFactory({ typescript: {} as unknown as typeof ts });
    expect(plugin).toHaveProperty('create');
    expect(typeof plugin.create).toBe('function');
  });
});

describe('@autotranslate/typescript-plugin - provideInlayHints', () => {
  it('emits a hint for a known key in the default target locale (de - alphabetically first)', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const greeting = t('hello');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file);
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    expect(hints.length).toBeGreaterThan(0);
    const translationHint = hints.find((h) => h.text.startsWith('»'));
    // default locale = 'de' (alphabetically first non-source dir)
    expect(translationHint?.text).toBe('» Hallo');
  });

  it('uses the configured locale when PluginConfig.locale is set', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHint = hints.find((h) => h.text.startsWith('»'));
    expect(translationHint?.text).toBe('» bonjour');
  });

  it('emits no hint for unknown keys (not in catalog)', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('this key does not exist');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHints = hints.filter((h) => h.text.startsWith('»'));
    expect(translationHints).toHaveLength(0);
  });

  it('truncates long translations to 40 chars and appends ellipsis', () => {
    // The source string with LONG_HASH:
    // 'A very long translation text that should be truncated because it exceeds forty characters'
    // The French translation in fixtures is > 40 chars.
    const longSourceStr =
      'A very long translation text that should be truncated because it exceeds forty characters';
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('${longSourceStr}');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHint = hints.find((h) => h.text.startsWith('»'));
    expect(translationHint).toBeDefined();
    // '» ' prefix is 2 chars, max translation part is 40 chars + ellipsis char
    const hintText = translationHint!.text;
    expect(hintText.startsWith('» ')).toBe(true);
    const translation = hintText.slice(2); // remove '» '
    expect(translation.endsWith('…')).toBe(true);
    expect(translation.slice(0, -1)).toHaveLength(40);
  });

  it('does not truncate translations that are 40 chars or fewer', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'de' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHint = hints.find((h) => h.text.startsWith('»'));
    expect(translationHint?.text).toBe('» Hallo');
    expect(translationHint?.text.endsWith('…')).toBe(false);
  });

  it('merges hints from the underlying language service', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    // The underlying TS language service may return 0 or more hints.
    // Our plugin must return at least the translation hint.
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHints = hints.filter((h) => h.text.startsWith('»'));
    expect(translationHints.length).toBeGreaterThanOrEqual(1);
  });

  it('handles useT alias binding: const t = useT() -> hint on t(key)', () => {
    const content = `
import { useT } from '@autotranslate/react';
function Comp() {
  const t = useT();
  return t('hello');
}
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHint = hints.find((h) => h.text.startsWith('»'));
    expect(translationHint?.text).toBe('» bonjour');
  });

  it('hint position is at the closing paren of the call expression', () => {
    const content = `import { t } from '@autotranslate/core/t';\nconst x = t('hello');`;
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHint = hints.find((h) => h.text.startsWith('»'));
    expect(translationHint).toBeDefined();
    // The call `t('hello')` ends at the char after ')'; position should be within the file.
    const callEnd = content.indexOf("t('hello')") + "t('hello')".length;
    expect(translationHint!.position).toBe(callEnd);
  });

  it('emits no hints when .translations directory is absent', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    // Point to a non-existent outDir so the catalog is empty.
    const service = createPluginLanguageService(file, {
      outDir: 'nonexistent-translations',
      locale: 'fr',
    });
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {});
    const translationHints = hints.filter((h) => h.text.startsWith('»'));
    expect(translationHints).toHaveLength(0);
  });
});

describe('@autotranslate/typescript-plugin - getSemanticDiagnostics', () => {
  it('emits diagnostic 99001 for a key not in the source catalog', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('this key does not exist in catalog');
    `.trim();
    const file = { name: '/virtual/diag.ts', content };
    const service = createPluginLanguageService(file);
    const diags = service.getSemanticDiagnostics(file.name);
    const ourDiags = diags.filter((d) => d.code === 99001);
    expect(ourDiags).toHaveLength(1);
    expect(ourDiags[0]!.messageText).toContain('this key does not exist in catalog');
  });

  it('emits no diagnostic for a key present in the source catalog', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/diag.ts', content };
    const service = createPluginLanguageService(file);
    const diags = service.getSemanticDiagnostics(file.name);
    const ourDiags = diags.filter((d) => d.code === 99001);
    expect(ourDiags).toHaveLength(0);
  });

  it('emits no diagnostic when the source catalog is absent (unknown outDir)', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/diag.ts', content };
    const service = createPluginLanguageService(file, { outDir: 'no-such-dir' });
    const diags = service.getSemanticDiagnostics(file.name);
    const ourDiags = diags.filter((d) => d.code === 99001);
    expect(ourDiags).toHaveLength(0);
  });

  it('respects severity config - suggestion', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('missing key');
    `.trim();
    const file = { name: '/virtual/diag.ts', content };
    const service = createPluginLanguageService(file, { severity: 'suggestion' });
    const diags = service.getSemanticDiagnostics(file.name);
    const ourDiags = diags.filter((d) => d.code === 99001);
    expect(ourDiags.length).toBeGreaterThan(0);
    expect(ourDiags[0]!.category).toBe(ts.DiagnosticCategory.Suggestion);
  });

  it('skips string args that start with t. (tree keys are not plain literals)', () => {
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('t.some.jsx.tree.key');
    `.trim();
    const file = { name: '/virtual/diag.ts', content };
    const service = createPluginLanguageService(file);
    const diags = service.getSemanticDiagnostics(file.name);
    const ourDiags = diags.filter((d) => d.code === 99001);
    expect(ourDiags).toHaveLength(0);
  });
});

describe('@autotranslate/typescript-plugin - catalog reader', () => {
  it('reads chunked directory tree and not flat <locale>.json', () => {
    // The fixture has translations-basic/en/a.json but NO translations-basic/en.json.
    // The plugin should find catalog entries successfully (directory tree only).
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('hello');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file);
    const diags = service.getSemanticDiagnostics(file.name);
    const ourDiags = diags.filter((d) => d.code === 99001);
    expect(ourDiags).toHaveLength(0);
  });

  it('hash values match between diagnostics and inlay hints (same shortHash impl)', () => {
    // If shortHash is consistent, a key that passes diagnostics should also get a hint.
    const content = `
import { t } from '@autotranslate/core/t';
const x = t('world');
    `.trim();
    const file = { name: '/virtual/comp.ts', content };
    const service = createPluginLanguageService(file, { locale: 'fr' });
    const diags = service.getSemanticDiagnostics(file.name).filter((d) => d.code === 99001);
    expect(diags).toHaveLength(0);
    const hints = service.provideInlayHints!(file.name, fullSpan(content), {}).filter((h) =>
      h.text.startsWith('»'),
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]!.text).toBe('» monde');
  });
});
