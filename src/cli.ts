/**
 * ccsk CLI entry point.
 * Single kit architecture: no kit selection, simplified commands.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runUninstall } from './commands/uninstall.js';
import { runAuth } from './commands/auth.js';
import { runCache } from './commands/cache.js';
import { runUpdate } from './commands/update.js';
import { runVersions } from './commands/versions.js';
import { runDesign } from './commands/design.js';
import { runDoctor } from './commands/doctor.js';
import { runDonate } from './commands/donate.js';
import { log } from './util/log.js';

function readPackageVersion(): string {
  try {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('ccsk')
  .description('Claude Code Starter Kit — install a fully-configured kit in one command')
  .version(readPackageVersion(), '-v, --version', 'show version')
  .helpOption('-h, --help', 'show help');

program
  .command('init')
  .description('Install the Claude Code Starter Kit into a project')
  .argument('[path]', 'target directory (defaults to current)', '.')
  .option('--version <ver>', 'kit version to install')
  .option('--pre', 'opt into prereleases when resolving the latest version', false)
  .option('--force', 'force re-download even if cached', false)
  .option('--no-setup', 'skip the tool setup (RTK-AI, context-mode)')
  .option('--no-add', 'skip ADD (AI-Driven Development) installation')
  .option('--plugin', 'legacy: install the ccsk plugin instead of materializing agents/skills into the project', false)
  .option('--plugin-scope <scope>', 'plugin install scope with --plugin: project | user', 'project')
  .option('-y, --yes', 'accept all prompts', false)
  .action(async (targetPath: string, opts) => {
    await guard(() =>
      runInit({
        targetPath,
        version: opts.version,
        pre: !!opts.pre,
        force: !!opts.force,
        setup: opts.setup !== false,
        add: opts.add !== false,
        usePlugin: !!opts.plugin,
        pluginScope: opts.pluginScope === 'user' ? 'user' : 'project',
        yes: !!opts.yes,
      }),
    );
  });

program
  .command('auth')
  .description('Check GitHub authentication status')
  .action(async () => {
    await guard(() => runAuth());
  });

program
  .command('update')
  .description('Update ccsk CLI, re-materialize templates, and update the ccsk plugin')
  .argument('[version]', 'CLI version to install (e.g. latest, 1.0.2)', 'latest')
  .option('--path <dir>', 'project directory to re-materialize templates into (bypasses the ccsk-project guard)')
  .option('--kit-version <ver>', 'kit version to materialize (defaults to latest)')
  .option('--plugin-scope <scope>', 'plugin install scope: project | user', 'project')
  .option('--pre', 'opt into prereleases — move to the newest prerelease', false)
  .option('--force', 'materialize the kit even if the current dir is not a ccsk project', false)
  .option('--no-templates', 'skip re-materializing kit templates')
  .option('--no-plugin', 'skip updating the ccsk Claude Code plugin')
  .action(async (version: string, opts) => {
    await guard(() =>
      runUpdate({
        version,
        targetPath: opts.path,
        kitVersion: opts.kitVersion,
        pre: !!opts.pre,
        force: !!opts.force,
        templates: opts.templates !== false,
        plugin: opts.plugin !== false,
        pluginScope: opts.pluginScope === 'user' ? 'user' : 'project',
      }),
    );
  });

program
  .command('cache')
  .description('Manage downloaded kit cache')
  .option('--version <ver>', 'specific version to download or clear')
  .option('-l, --list', 'list cached versions', false)
  .option('--clear', 'clear cache', false)
  .option('--clear-all', 'clear all cached versions', false)
  .action(async (opts) => {
    await guard(() =>
      runCache({
        version: opts.version,
        list: !!opts.list,
        clear: !!opts.clear,
        clearAll: !!opts.clearAll,
      }),
    );
  });

program
  .command('versions')
  .description('List available kit versions (remote + cached + current)')
  .option('--all', 'show the full, untruncated list (incl. prereleases)', false)
  .option('--pre', 'include prereleases (beta/rc/alpha)', false)
  .option('--json', 'print machine-readable JSON', false)
  .action(async (opts) => {
    await guard(() =>
      runVersions({
        all: !!opts.all,
        pre: !!opts.pre,
        json: !!opts.json,
      }),
    );
  });

program
  .command('design')
  .description('Add a design reference (DESIGN.md) to a project')
  .argument('[path]', 'target directory (defaults to current)', '.')
  .action(async (targetPath: string) => {
    await guard(() => runDesign({ targetPath, yes: false }));
  });

program
  .command('doctor')
  .description('Diagnose a broken ccsk install or environment')
  .action(async () => {
    await guard(() => runDoctor());
  });

program
  .command('donate')
  .description('Support the project with a coffee via VietQR')
  .action(async () => {
    await guard(() => runDonate());
  });

program
  .command('uninstall')
  .description('Remove kit files from a project')
  .argument('[path]', 'target directory (defaults to current)', '.')
  .option('-y, --yes', 'accept the file-removal prompt', false)
  .option('--purge-memory', 'also remove user memory (.ccsk/), backed up first', false)
  .action(async (targetPath: string, opts) => {
    await guard(() =>
      runUninstall({ targetPath, yes: !!opts.yes, purgeMemory: !!opts.purgeMemory }),
    );
  });

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    if (process.env.CCSK_DEBUG && err instanceof Error) console.error(err.stack);
    process.exit(1);
  }
}

program.parseAsync(process.argv);
