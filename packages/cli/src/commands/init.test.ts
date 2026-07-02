import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { init } from './init';

/** Minimal package.json with a Next.js dependency. */
async function makeNextProject(cwd: string, nextConfigContent?: string) {
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'my-app',
      dependencies: { next: '16.0.0', react: '19.0.0' },
    }),
    'utf8',
  );
  await writeFile(
    join(cwd, 'next.config.ts'),
    nextConfigContent ??
      [
        'import type { NextConfig } from "next";',
        '',
        'const nextConfig: NextConfig = {',
        '  /* config options here */',
        '};',
        '',
        'export default nextConfig;',
        '',
      ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(cwd, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: { target: 'esnext' },
        include: ['**/*.ts', '**/*.tsx'],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(join(cwd, '.gitignore'), 'node_modules\n.next\n', 'utf8');
}

async function makeViteProject(cwd: string) {
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'my-vite-app',
      dependencies: { vite: '5.0.0', react: '19.0.0' },
    }),
    'utf8',
  );
}

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'autotranslate-init-'));
}

describe('init - Next.js project', () => {
  it('writes all files for a fresh Next project', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);

    const result = await init({ cwd });

    expect(result.framework).toBe('next');

    const configStep = result.steps.find((s) => s.label.includes('autotranslate.config.ts'));
    expect(configStep?.status).toBe('done');
    const configContent = await readFile(join(cwd, 'autotranslate.config.ts'), 'utf8');
    expect(configContent).toContain('defineConfig');
    expect(configContent).toContain("targets: ['es', 'fr', 'ja']");
    expect(configContent).toContain("name: 'ai'");
    expect(configContent).toContain('anthropic:claude-haiku-4-5');
    expect(configContent).toContain('process.env.ANTHROPIC_API_KEY');

    const wrapStep = result.steps.find((s) => s.label.includes('next.config.ts'));
    expect(wrapStep?.status).toBe('done');
    expect(wrapStep?.detail).toBe('(AST edit)');
    const nextConfigContent = await readFile(join(cwd, 'next.config.ts'), 'utf8');
    expect(nextConfigContent).toContain(
      "import { withAutotranslate } from '@autotranslate/next/plugin';",
    );
    expect(nextConfigContent).toContain('export default withAutotranslate(nextConfig);');
    expect(nextConfigContent).toContain('import type { NextConfig } from "next";');
    expect(nextConfigContent).toContain('const nextConfig: NextConfig = {');

    const proxyStep = result.steps.find((s) => s.label.includes('proxy.ts'));
    expect(proxyStep?.status).toBe('done');
    expect(existsSync(join(cwd, 'proxy.ts'))).toBe(true);
    const proxyContent = await readFile(join(cwd, 'proxy.ts'), 'utf8');
    expect(proxyContent).toContain("from '@autotranslate/next/middleware'");
    expect(proxyContent).toContain("defaultLocale: 'en'");
    expect(proxyContent).toContain("'es'");
    expect(proxyContent).toContain("'fr'");
    expect(proxyContent).toContain("'ja'");

    const tsconfigStep = result.steps.find((s) => s.label.includes('tsconfig.json'));
    expect(tsconfigStep?.status).toBe('done');
    const tsconfigContent = await readFile(join(cwd, 'tsconfig.json'), 'utf8');
    expect(tsconfigContent).toContain('.translations/types.d.ts');

    const gitignoreStep = result.steps.find((s) => s.label.includes('.gitignore'));
    expect(gitignoreStep?.status).toBe('done');
    const gitignoreContent = await readFile(join(cwd, '.gitignore'), 'utf8');
    expect(gitignoreContent).toContain('.translations/.cache/');

    const layoutStep = result.steps.find((s) => s.label.includes('layout.tsx'));
    expect(layoutStep?.status).toBe('skipped');
    expect(layoutStep?.diff).toContain('catalogModule');
    expect(layoutStep?.diff).toContain('TranslationProvider');
  });

  it('reports exact next.config.ts output', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);

    await init({ cwd });

    const content = await readFile(join(cwd, 'next.config.ts'), 'utf8');

    // The import must come before the export
    const importPos = content.indexOf('import { withAutotranslate }');
    const exportPos = content.indexOf('export default');
    expect(importPos).toBeGreaterThanOrEqual(0);
    expect(exportPos).toBeGreaterThan(importPos);

    expect(content).toContain('export default withAutotranslate(nextConfig);');
    expect(content).toContain('import type { NextConfig } from "next";');
  });

  it('second run - all persistent steps report already-configured', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);

    await init({ cwd });
    const second = await init({ cwd });

    expect(second.framework).toBe('next');

    for (const step of second.steps) {
      if (step.label.includes('layout.tsx')) {
        // Layout is always skipped (manual diff)
        expect(step.status).toBe('skipped');
      } else {
        expect(step.status).toBe('already-configured');
      }
    }
  });

  it('second run leaves all files unchanged', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);

    await init({ cwd });

    const files = [
      'autotranslate.config.ts',
      'next.config.ts',
      'proxy.ts',
      'tsconfig.json',
      '.gitignore',
    ];
    const contentsBefore = await Promise.all(files.map((f) => readFile(join(cwd, f), 'utf8')));

    await init({ cwd });

    const contentsAfter = await Promise.all(files.map((f) => readFile(join(cwd, f), 'utf8')));

    for (let i = 0; i < files.length; i++) {
      expect(contentsAfter[i], `${files[i]} should be unchanged`).toBe(contentsBefore[i]);
    }
  });

  it('unrecognized next.config (no default export) -> skipped with manual diff', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd, '// No export default here\nconst x = 1;\n');

    const result = await init({ cwd });

    const wrapStep = result.steps.find((s) => s.label.includes('next.config'));
    expect(wrapStep?.status).toBe('skipped');
    expect(wrapStep?.diff).toBeTruthy();

    const content = await readFile(join(cwd, 'next.config.ts'), 'utf8');
    expect(content).toBe('// No export default here\nconst x = 1;\n');
  });

  it('handles export default with call expression (e.g. withMDX()(nextConfig))', async () => {
    const cwd = await tempDir();
    await makeNextProject(
      cwd,
      [
        `import withMDX from '@next/mdx';`,
        ``,
        `export default withMDX()({`,
        `  pageExtensions: ['js', 'jsx', 'md', 'mdx'],`,
        `});`,
        ``,
      ].join('\n'),
    );

    const result = await init({ cwd });

    const wrapStep = result.steps.find((s) => s.label.includes('next.config'));
    expect(wrapStep?.status).toBe('done');

    const content = await readFile(join(cwd, 'next.config.ts'), 'utf8');
    expect(content).toContain('withAutotranslate(withMDX()(');
  });

  it('--force overwrites existing autotranslate.config.ts', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);
    await writeFile(join(cwd, 'autotranslate.config.ts'), '// keep me', 'utf8');

    const result = await init({ cwd, force: true });
    const configStep = result.steps.find((s) => s.label.includes('autotranslate.config.ts'));
    expect(configStep?.status).toBe('done');

    const content = await readFile(join(cwd, 'autotranslate.config.ts'), 'utf8');
    expect(content).not.toBe('// keep me');
    expect(content).toContain('defineConfig');
  });

  it('uses provider stub when specified', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);

    await init({ cwd, provider: 'stub' });

    const content = await readFile(join(cwd, 'autotranslate.config.ts'), 'utf8');
    expect(content).toContain("{ name: 'stub' }");
    expect(content).not.toContain('process.env');
  });

  it('uses specified targets', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);

    await init({ cwd, targets: ['de', 'pt'] });

    const configContent = await readFile(join(cwd, 'autotranslate.config.ts'), 'utf8');
    expect(configContent).toContain("targets: ['de', 'pt']");

    const proxyContent = await readFile(join(cwd, 'proxy.ts'), 'utf8');
    expect(proxyContent).toContain("'de'");
    expect(proxyContent).toContain("'pt'");
  });

  it('creates proxy.ts in src/ when src/ dir exists', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);
    await mkdir(join(cwd, 'src'), { recursive: true });

    await init({ cwd });

    expect(existsSync(join(cwd, 'src', 'proxy.ts'))).toBe(true);
    expect(existsSync(join(cwd, 'proxy.ts'))).toBe(false);
  });

  it('adds to tsconfig include when existing include is multiline', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);
    await writeFile(
      join(cwd, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: { target: 'esnext' },
          include: ['**/*.ts', '**/*.tsx'],
        },
        null,
        2,
      ).replace('"**/*.tsx"', '"**/*.tsx"\n  '),
      'utf8',
    );

    await init({ cwd });

    const content = await readFile(join(cwd, 'tsconfig.json'), 'utf8');
    expect(content).toContain('.translations/types.d.ts');
  });

  it('next.config already wrapped -> already-configured', async () => {
    const cwd = await tempDir();
    await makeNextProject(
      cwd,
      [
        `import { withAutotranslate } from '@autotranslate/next/plugin';`,
        `export default withAutotranslate({});`,
        ``,
      ].join('\n'),
    );

    const result = await init({ cwd });

    const wrapStep = result.steps.find((s) => s.label.includes('next.config'));
    expect(wrapStep?.status).toBe('already-configured');

    const content = await readFile(join(cwd, 'next.config.ts'), 'utf8');
    expect(content).toContain('withAutotranslate');
    expect(content).not.toContain(
      "import { withAutotranslate } from '@autotranslate/next/plugin';\nimport { withAutotranslate }",
    );
  });
});

describe('init - Vite project', () => {
  it('detects vite from package.json', async () => {
    const cwd = await tempDir();
    await makeViteProject(cwd);

    const result = await init({ cwd });

    expect(result.framework).toBe('vite');
    const viteStep = result.steps.find((s) => s.label.includes('vite.config'));
    expect(viteStep?.status).toBe('skipped');
    expect(viteStep?.diff).toContain('@autotranslate/vite');
  });

  it('does not create proxy.ts for vite', async () => {
    const cwd = await tempDir();
    await makeViteProject(cwd);

    await init({ cwd });

    expect(existsSync(join(cwd, 'proxy.ts'))).toBe(false);
    expect(existsSync(join(cwd, 'src', 'proxy.ts'))).toBe(false);
  });
});

describe('init - framework override', () => {
  it('respects explicit --framework next even without next in package.json', async () => {
    const cwd = await tempDir();
    await makeViteProject(cwd);

    const result = await init({ cwd, framework: 'next' });
    expect(result.framework).toBe('next');
  });
});

describe('init - tsconfig edge cases', () => {
  it('skips tsconfig when file does not exist', async () => {
    const cwd = await tempDir();
    await makeViteProject(cwd);

    const result = await init({ cwd });
    const tsconfigStep = result.steps.find((s) => s.label.includes('tsconfig'));
    expect(tsconfigStep?.status).toBe('skipped');
  });

  it('handles tsconfig with no include key', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);
    await writeFile(
      join(cwd, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'esnext' } }, null, 2),
      'utf8',
    );

    await init({ cwd });

    const content = await readFile(join(cwd, 'tsconfig.json'), 'utf8');
    expect(content).toContain('.translations/types.d.ts');
  });

  it('handles tsconfig with comments (JSONC)', async () => {
    const cwd = await tempDir();
    await makeNextProject(cwd);
    await writeFile(
      join(cwd, 'tsconfig.json'),
      '{\n  // a comment\n  "compilerOptions": {},\n  "include": ["src"]\n}\n',
      'utf8',
    );

    const result = await init({ cwd });
    const tsconfigStep = result.steps.find((s) => s.label.includes('tsconfig'));
    expect(tsconfigStep?.status).toBe('done');

    const content = await readFile(join(cwd, 'tsconfig.json'), 'utf8');
    expect(content).toContain('// a comment');
    expect(content).toContain('.translations/types.d.ts');
  });
});

describe('init - gitignore edge cases', () => {
  it('creates .gitignore if absent', async () => {
    const cwd = await tempDir();
    await makeViteProject(cwd);
    await init({ cwd });

    const content = await readFile(join(cwd, '.gitignore'), 'utf8');
    expect(content).toContain('.translations/.cache/');
  });

  it('appends to existing .gitignore without duplication', async () => {
    const cwd = await tempDir();
    await makeViteProject(cwd);
    await writeFile(join(cwd, '.gitignore'), 'node_modules\n', 'utf8');

    await init({ cwd });
    await init({ cwd }); // second run

    const content = await readFile(join(cwd, '.gitignore'), 'utf8');
    const matches = content.split('\n').filter((l) => l.trim() === '.translations/.cache/');
    expect(matches).toHaveLength(1);
  });
});
