import path from 'node:path';
import { confirm, isCancel, cancel } from '@clack/prompts';
import { execa } from 'execa';
import { existingKitPaths, removeKit } from '../core/remove-kit.js';
import { binExists } from '../util/platform.js';
import { log } from '../util/log.js';
export async function runUninstall(opts) {
    const targetAbs = path.resolve(process.cwd(), opts.targetPath);
    const present = await existingKitPaths(targetAbs);
    if (present.length === 0) {
        log.info(`No ccsk kit files found in ${targetAbs}.`);
    }
    else if (await confirmRemoveFiles(present, opts.yes)) {
        const removed = await removeKit(targetAbs);
        log.success(`Removed: ${removed.join(', ')}`);
    }
    else {
        cancel('Cancelled — nothing was removed.');
        return;
    }
    if (await confirmRemoveTools(opts.yes)) {
        await removeTools();
    }
    if (await confirmRemoveCcsk(opts.yes)) {
        await removeCcsk();
    }
}
async function confirmRemoveFiles(present, yes) {
    log.warn(`This will delete from the project: ${present.join(', ')}`);
    if (yes)
        return true;
    const answer = await confirm({ message: 'Delete these kit files?', initialValue: true });
    return !isCancel(answer) && answer === true;
}
async function confirmRemoveTools(yes) {
    log.warn('RTK-AI, context-mode, and Serena are installed globally and may be used by other projects.');
    if (yes)
        return false; // never auto-remove globally-shared tools
    const answer = await confirm({
        message: 'Also uninstall RTK-AI, context-mode, and Serena?',
        initialValue: false,
    });
    return !isCancel(answer) && answer === true;
}
async function confirmRemoveCcsk(yes) {
    if (yes)
        return false; // never auto-remove ccsk itself
    const answer = await confirm({
        message: 'Also uninstall ccsk CLI globally?',
        initialValue: false,
    });
    return !isCancel(answer) && answer === true;
}
/** Best-effort, non-fatal removal of the globally-installed tools. */
async function removeTools() {
    if (await binExists('claude')) {
        for (const args of [
            ['mcp', 'remove', 'context-mode'],
            ['mcp', 'remove', 'serena'],
            ['mcp', 'remove', '--scope', 'user', 'serena'],
        ]) {
            const { exitCode } = await execa('claude', args, { reject: false });
            if (exitCode === 0)
                log.success(`Removed ${args[args.length - 1]} MCP`);
        }
    }
    log.dim('    Remove the plugin inside Claude Code: /plugin uninstall context-mode@context-mode');
    if (await binExists('rtk')) {
        const tool = (await binExists('brew')) ? 'brew' : (await binExists('cargo')) ? 'cargo' : null;
        if (tool) {
            const { exitCode } = await execa(tool, ['uninstall', 'rtk'], { reject: false });
            log[exitCode === 0 ? 'success' : 'warn'](exitCode === 0 ? `Uninstalled rtk via ${tool}` : `Could not uninstall rtk via ${tool}`);
        }
        else {
            log.warn('rtk is installed but no brew/cargo found to remove it (skipped).');
        }
    }
    if (await binExists('uv')) {
        const { exitCode } = await execa('uv', ['tool', 'uninstall', 'serena-agent'], { reject: false });
        log[exitCode === 0 ? 'success' : 'warn'](exitCode === 0 ? 'Uninstalled serena-agent via uv' : 'Could not uninstall serena-agent (skipped)');
    }
}
/** Detect package manager and uninstall ccsk globally. */
async function removeCcsk() {
    const pkgName = 'cc-starter-kit';
    // npm unlink -g works for both linked packages AND regular global installs
    // It's the most reliable cross-platform method
    if (await binExists('npm')) {
        const { exitCode } = await execa('npm', ['unlink', '-g', pkgName], { reject: false });
        if (exitCode === 0 && !(await binExists('ccsk'))) {
            log.success('Uninstalled ccsk via npm unlink -g');
            return;
        }
    }
    // Try bun remove -g (for bun add -g installs, not bun link)
    if (await binExists('bun')) {
        const { exitCode } = await execa('bun', ['remove', '-g', pkgName], { reject: false });
        if (exitCode === 0 && !(await binExists('ccsk'))) {
            log.success('Uninstalled ccsk via bun');
            return;
        }
    }
    // Try pnpm
    if (await binExists('pnpm')) {
        const { exitCode } = await execa('pnpm', ['remove', '-g', pkgName], { reject: false });
        if (exitCode === 0 && !(await binExists('ccsk'))) {
            log.success('Uninstalled ccsk via pnpm');
            return;
        }
    }
    // Check if ccsk is still available
    if (await binExists('ccsk')) {
        log.warn('Could not uninstall ccsk automatically.');
        log.dim('    If installed via bun link, run: cd <ccsk-repo> && bun unlink');
        log.dim('    Otherwise try: npm uninstall -g cc-starter-kit');
    }
    else {
        log.success('ccsk has been uninstalled');
    }
}
//# sourceMappingURL=uninstall.js.map