import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

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

const packDirectory = mkdtempSync(join(tmpdir(), 'autotranslate-pack-'));

try {
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

    verifyPackedManifest(directory, manifest.name, packDirectory);

    for (const [name, target] of Object.entries(manifest.bin ?? {})) {
      assertBuiltFile(directory, manifest.name, `bin:${name}`, target);
    }

    await verifyRuntimeEntries(directory, manifest);
  }

  process.stdout.write(`\nVerified ${packages.length} public packages.\n`);
} finally {
  rmSync(packDirectory, { recursive: true, force: true });
}

function verifyPackedManifest(directory, packageName, destination) {
  const packed = spawnSync(packageManager, ['pack', '--pack-destination', destination, '--json'], {
    cwd: directory,
    encoding: 'utf8',
  });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) {
    process.stderr.write(packed.stdout);
    process.stderr.write(packed.stderr);
    process.exit(packed.status ?? 1);
  }

  const result = JSON.parse(packed.stdout);
  const filename = Array.isArray(result) ? result[0]?.filename : result.filename;
  if (!filename) throw new Error(`${packageName} pack did not report an archive filename`);

  const manifest = readPackedManifest(resolve(directory, filename));
  const workspaceReferences = findWorkspaceReferences(manifest);
  if (workspaceReferences.length > 0) {
    throw new Error(
      `${packageName} packed manifest contains workspace protocol references:\n${workspaceReferences.join('\n')}`,
    );
  }
}

function readPackedManifest(filename) {
  const archive = gunzipSync(readFileSync(filename));

  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    const name = readTarString(header, 0, 100);
    if (!name) break;

    const prefix = readTarString(header, 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(readTarString(header, 124, 12).trim() || '0', 8);
    const contentOffset = offset + 512;

    if (path === 'package/package.json') {
      return JSON.parse(archive.subarray(contentOffset, contentOffset + size).toString('utf8'));
    }

    offset = contentOffset + Math.ceil(size / 512) * 512;
  }

  throw new Error(`Packed archive ${filename} does not contain package/package.json`);
}

function readTarString(buffer, offset, length) {
  const end = buffer.indexOf(0, offset);
  const boundedEnd = end === -1 || end > offset + length ? offset + length : end;
  return buffer.subarray(offset, boundedEnd).toString('utf8');
}

function findWorkspaceReferences(value, path = []) {
  if (typeof value === 'string') {
    return value.startsWith('workspace:') ? [`${path.join('.')} = ${value}`] : [];
  }
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) =>
    findWorkspaceReferences(child, [...path, key]),
  );
}

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
