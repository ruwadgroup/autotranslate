import { createRequire } from 'node:module';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { check } from './commands/check';
import { extract } from './commands/extract';
import { find } from './commands/find';
import { generateTypes, relativeFromCwd } from './commands/generate-types';
import { init } from './commands/init';
import { formatParityReport, parity } from './commands/parity';
import { translate } from './commands/translate';
import { ConfigNotFoundError, loadConfig } from './config-loader';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('autotranslate')
  .description('AI-powered i18n CLI for autotranslate.')
  .version(version);

program
  .command('init')
  .description('Scaffold autotranslate for the current project (non-interactive).')
  .option(
    '--framework <framework>',
    'framework: next or vite (default: auto-detect from package.json)',
  )
  .option('--targets <locales>', 'comma-separated target locales (default: es,fr,ja)')
  .option(
    '--provider <provider>',
    'translation provider: anthropic, openai, google, deepl, stub (default: anthropic)',
  )
  .option('--force', 'overwrite existing autotranslate.config.ts', false)
  .action(
    async (opts: { framework?: string; targets?: string; provider?: string; force?: boolean }) => {
      const result = await init({
        ...(opts.framework ? { framework: opts.framework as 'next' | 'vite' } : {}),
        ...(opts.targets ? { targets: opts.targets.split(',').map((t) => t.trim()) } : {}),
        ...(opts.provider
          ? { provider: opts.provider as 'anthropic' | 'openai' | 'google' | 'deepl' | 'stub' }
          : {}),
        force: opts.force ?? false,
      });

      if (result.framework) {
        const fw = result.framework === 'next' ? 'Next.js' : 'Vite';
        console.log(chalk.green('+'), `Detected ${fw}`);
      }

      for (const step of result.steps) {
        const prefix =
          step.status === 'done'
            ? chalk.green('+')
            : step.status === 'already-configured'
              ? chalk.dim('=')
              : chalk.yellow('~');

        const label = step.status === 'already-configured' ? chalk.dim(step.label) : step.label;

        const detail = step.detail ? chalk.dim(` ${step.detail}`) : '';

        console.log(`${prefix} ${label}${detail}`);

        if (step.diff) {
          console.log();
          for (const line of step.diff.split('\n')) {
            console.log(chalk.dim('  ') + chalk.cyan(line));
          }
          console.log();
        }
      }

      console.log();
      console.log('Next: run `pnpm dev` and write some copy. Translations appear on save.');
    },
  );

program
  .command('extract')
  .description('Scan source files and write the source-locale catalog.')
  .action(async () => {
    const resolved = await loadConfig();
    const result = await extract(resolved);
    const messageCount = Object.keys(result.source).length;
    console.log(
      chalk.green('✓'),
      'extracted',
      chalk.cyan(`${messageCount}`),
      'messages from',
      chalk.cyan(`${result.fileCount}`),
      'files',
    );
  });

program
  .command('translate')
  .description('Translate the source catalog into every target locale.')
  .option('-l, --locale <locale...>', 'restrict to specific target locales')
  .action(async (opts: { locale?: string[] }) => {
    const resolved = await loadConfig();
    let inFlight = 0;
    let done = 0;
    const spinner = ora({ text: 'translating…', color: 'cyan' }).start();
    const result = await translate(resolved, {
      ...(opts.locale ? { only: opts.locale } : {}),
      onProgress: (event) => {
        if (event.status === 'started') inFlight += 1;
        else {
          inFlight -= 1;
          done += 1;
        }
        spinner.text = `translating… ${chalk.cyan(`${done}`)} done${
          inFlight > 0 ? chalk.dim(`, ${inFlight} in flight`) : ''
        }`;
      },
    });
    spinner.stop();
    for (const [locale, stats] of Object.entries(result.stats)) {
      console.log(
        chalk.green('✓'),
        chalk.cyan(locale),
        '—',
        `${stats.fetched} new`,
        chalk.dim(`(${stats.cached} cached, ${stats.overridden} overridden)`),
      );
    }
  });

program
  .command('generate-types')
  .description(
    'Emit a .d.ts that augments @autotranslate/core with the literal catalog keys (AutotranslateCatalog).',
  )
  .action(async () => {
    const resolved = await loadConfig();
    const result = await generateTypes(resolved);
    console.log(
      chalk.green('✓'),
      'wrote',
      chalk.cyan(relativeFromCwd(result.path, resolved.cwd)),
      chalk.dim(`(${result.keyCount} keys)`),
    );
  });

program
  .command('check')
  .description('Verify every target locale is in sync with the source catalog.')
  .action(async () => {
    const resolved = await loadConfig();
    const result = await check(resolved);
    if (result.ok) {
      console.log(chalk.green('✓'), 'all catalogs in sync');
      return;
    }
    for (const p of result.problems) {
      const tag =
        p.kind === 'missing'
          ? chalk.yellow('missing')
          : p.kind === 'orphan'
            ? chalk.magenta('orphan')
            : chalk.red('invalid-icu');
      console.log(`  ${tag}`, chalk.cyan(p.locale), p.key, p.message ? chalk.dim(p.message) : '');
    }
    console.log(chalk.red('✗'), `${result.problems.length} problem(s)`);
    process.exitCode = 1;
  });

program
  .command('parity')
  .description('Diff catalogs against a base git ref and report locale parity (for PR review).')
  .option('--base <ref>', 'git ref to diff against', 'origin/main')
  .option('--format <format>', 'output format: text or github', 'text')
  .action(async (opts: { base: string; format: 'text' | 'github' }) => {
    const resolved = await loadConfig();
    const report = await parity(resolved, { base: opts.base, format: opts.format });
    console.log(formatParityReport(report, opts.format));
    if (!report.ok) process.exitCode = 1;
  });

program
  .command('find <hash>')
  .description('Look up a catalog key by its 12-hex hash. Prints the source string + call sites.')
  .action(async (hash: string) => {
    const resolved = await loadConfig();
    const result = await find(resolved, hash);
    if (!result) {
      console.log(chalk.yellow('!'), `no catalog entry for ${chalk.cyan(hash)}`);
      console.log(
        chalk.dim('  expected a 12-hex hash, optionally prefixed with t. (e.g. 9f3a1c2b4d5e).'),
      );
      process.exitCode = 1;
      return;
    }
    console.log(chalk.green('✓'), chalk.cyan(result.key));
    if (typeof result.source === 'string') {
      console.log('  source:', chalk.white(JSON.stringify(result.source)));
    } else if (Array.isArray(result.source)) {
      console.log('  source:', chalk.dim('<structured tree>'));
    } else {
      console.log('  source:', chalk.dim('(no source-locale entry — orphan)'));
    }
    if (result.context) console.log('  context:', chalk.white(result.context));
    if (result.description) console.log('  description:', chalk.white(result.description));
    if (result.occurrences.length === 0) {
      console.log(chalk.dim('  no call sites recorded — re-run `autotranslate extract`.'));
    } else {
      for (const o of result.occurrences) {
        console.log('  at', chalk.cyan(`${o.file}:${o.line}${o.column ? `:${o.column}` : ''}`));
      }
    }
  });

program.parseAsync().catch((error) => {
  if (error instanceof ConfigNotFoundError) {
    console.error(chalk.red('error:'), error.message);
  } else {
    console.error(chalk.red('error:'), error instanceof Error ? error.message : error);
    if (process.env.DEBUG) {
      console.error(error);
    }
  }
  process.exit(1);
});
