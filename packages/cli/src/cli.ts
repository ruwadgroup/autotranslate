import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { check } from './commands/check';
import { extract } from './commands/extract';
import { generateTypes, relativeFromCwd } from './commands/generate-types';
import { init } from './commands/init';
import { migrate } from './commands/migrate';
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
    console.log();
    console.log(chalk.dim('Tip — for AI assistants (Claude Code, Cursor, Windsurf):'));
    console.log(chalk.dim('  Add this line to your AGENTS.md / CLAUDE.md / .cursorrules:'));
    console.log(chalk.cyan('    See node_modules/@autotranslate/cli/dist/agents.md'));
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
  .description('Emit a .d.ts that augments @autotranslate/react with the literal catalog keys.')
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
  .command('migrate-format')
  .description('Re-shape catalogs into the 1.0.0-beta.2 hash-bucketed layout.')
  .action(async () => {
    const resolved = await loadConfig();
    const result = await migrate(resolved);
    if (result.locales.length === 0) {
      console.log(chalk.yellow('!'), 'no catalogs found; nothing to migrate.');
      return;
    }
    console.log(
      chalk.green('✓'),
      'migrated',
      chalk.cyan(`${result.keyCount}`),
      'keys across',
      chalk.cyan(`${result.locales.length}`),
      'locale(s):',
      chalk.dim(result.locales.join(', ')),
    );
    if (result.cacheCleared) {
      console.log(chalk.dim('  cleared the provider cache so the next translate run is clean.'));
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
