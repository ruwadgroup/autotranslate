import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const require = createRequire(import.meta.url);
const hostBundledEsmEntries = new Set(['@autotranslate/next:./middleware']);

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name))
  .filter((directory) => existsSync(join(directory, 'package.json')))
  .sort();

for (const directory of packages) {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  process.stdout.write(`\nChecking ${manifest.name}\n`);

  const lint = spawnSync(
    packageManager,
    ['exec', 'publint', 'run', directory, '--strict', '--pack', 'pnpm'],
    { cwd: root, stdio: 'inherit' },
  );
  if (lint.error) throw lint.error;
  if (lint.status !== 0) process.exit(lint.status ?? 1);

  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    assertBuiltFile(directory, manifest.name, `bin:${name}`, target);
  }

  await verifyRuntimeEntries(directory, manifest);
}

process.stdout.write(`\nVerified ${packages.length} public packages.\n`);

async function verifyRuntimeEntries(directory, manifest) {
  if (manifest.exports) {
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      if (!target || typeof target === 'string') continue;

      const importPath = target.import?.default;
      if (importPath && !hostBundledEsmEntries.has(`${manifest.name}:${subpath}`)) {
        assertBuiltFile(directory, manifest.name, subpath, importPath);
        await import(pathToFileURL(join(directory, importPath)).href);
      }

      const requirePath = target.require?.default;
      if (requirePath) {
        assertBuiltFile(directory, manifest.name, subpath, requirePath);
        require(join(directory, requirePath));
      }
    }
    return;
  }

  if (manifest.main) {
    assertBuiltFile(directory, manifest.name, '.', manifest.main);
    require(join(directory, manifest.main));
  }
}

function assertBuiltFile(directory, packageName, subpath, target) {
  if (existsSync(join(directory, target))) return;
  throw new Error(`${packageName} ${subpath} points to missing build output ${target}`);
}
