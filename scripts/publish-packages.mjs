import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changesetCli = path.join(root, 'node_modules', '@changesets', 'cli', 'bin.js');
const env = { ...process.env };

for (const name of [
  'npm_config__jsr_registry',
  'npm_config_git_checks',
  'npm_config_overrides',
  'npm_config_verify_deps_before_run',
]) {
  delete env[name];
}

const child = spawn(process.execPath, [changesetCli, 'publish'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
