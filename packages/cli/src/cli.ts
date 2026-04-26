import chalk from 'chalk';
import { Command } from 'commander';
import { check } from './commands/check';
import { extract } from './commands/extract';
import { init } from './commands/init';
import { translate } from './commands/translate';
import { ConfigNotFoundError, loadConfig } from './config-loader';

const program = new Command();

program
  .name('autotranslate')
  .description('AI-powered i18n CLI for autotranslate.')
  .version('0.0.0');

program
  .command('init')
  .description('Scaffold autotranslate.config.ts in the current directory.')
  .option('--force', 'overwrite an existing config', false)
  .action(async (opts: { force?: boolean }) => {
    const result = await init({ ...(opts.force ? { force: true } : {}) });
    if (result.created) {
      console.log(chalk.green('✓'), 'created', chalk.cyan(result.path));
    } else {
      console.log(
        chalk.yellow('!'),
        chalk.cyan(result.path),
        'already exists — pass --force to overwrite.',
      );
    }
  });

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
    const result = await translate(resolved, {
      ...(opts.locale ? { only: opts.locale } : {}),
    });
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
