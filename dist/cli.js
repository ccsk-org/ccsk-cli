/**
 * ccsk CLI entry point.
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
import { log } from './util/log.js';
function readPackageVersion() {
    try {
        const here = fileURLToPath(new URL('.', import.meta.url));
        const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
        return pkg.version ?? '0.0.0';
    }
    catch {
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
    .description('Install a Claude Code starter kit into a project')
    .argument('[path]', 'target directory (defaults to current)', '.')
    .option('-k, --kit <name>', 'kit to install (common, frontend, backend, mobile)')
    .option('--version <ver>', 'kit version to install')
    .option('--force', 'force re-download even if cached', false)
    .option('--no-setup', 'skip the tool setup (RTK-AI, context-mode)')
    .option('-y, --yes', 'accept all prompts', false)
    .action(async (targetPath, opts) => {
    await guard(() => runInit({
        targetPath,
        kit: opts.kit,
        version: opts.version,
        force: !!opts.force,
        setup: opts.setup !== false,
        yes: !!opts.yes,
    }));
});
program
    .command('auth')
    .description('Check GitHub authentication status')
    .action(async () => {
    await guard(() => runAuth());
});
program
    .command('update')
    .description('Update ccsk CLI to the latest or a specific version')
    .argument('[version]', 'version to install (e.g. latest, 1.0.2)', 'latest')
    .action(async (version) => {
    await guard(() => runUpdate({ version }));
});
program
    .command('cache')
    .description('Manage downloaded kit cache')
    .option('-k, --kit <name>', 'kit to download or clear')
    .option('--version <ver>', 'specific version')
    .option('-l, --list', 'list cached kits', false)
    .option('--clear', 'clear cache for specified kit', false)
    .option('--clear-all', 'clear all cached kits', false)
    .action(async (opts) => {
    await guard(() => runCache({
        kit: opts.kit,
        version: opts.version,
        list: !!opts.list,
        clear: !!opts.clear,
        clearAll: !!opts.clearAll,
    }));
});
program
    .command('uninstall')
    .description('Remove kit files from a project')
    .argument('[path]', 'target directory (defaults to current)', '.')
    .option('-y, --yes', 'accept the file-removal prompt', false)
    .action(async (targetPath, opts) => {
    await guard(() => runUninstall({ targetPath, yes: !!opts.yes }));
});
async function guard(fn) {
    try {
        await fn();
    }
    catch (err) {
        log.error(err instanceof Error ? err.message : String(err));
        if (process.env.CCSK_DEBUG && err instanceof Error)
            console.error(err.stack);
        process.exit(1);
    }
}
program.parseAsync(process.argv);
//# sourceMappingURL=cli.js.map