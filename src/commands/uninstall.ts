import fs from 'node:fs';
import path from 'node:path';
import { confirm, isCancel, cancel } from '@clack/prompts';
import { execa } from 'execa';
import {
  existingKitPaths,
  existingUserMemoryPaths,
  removeKit,
  SCAFFOLD_PATHS,
} from '../core/remove-kit.js';
import { removeCcskPlugin } from '../core/plugin-install.js';
import { CCSK_PACKAGE_NAME, removeCcskGlobally } from '../core/pkg-manager.js';
import { binExists, homeDir } from '../util/platform.js';
import { log, pc } from '../util/log.js';

const CCSK_HOME = path.join(homeDir(), '.ccsk');

export interface UninstallOptions {
  targetPath: string;
  /** Auto-confirm both the file removal and the tool removal. */
  yes: boolean;
  /** Also remove USER MEMORY (after backing it up to `.ccsk.bak-<ts>/`). */
  purgeMemory?: boolean;
}

export async function runUninstall(opts: UninstallOptions): Promise<void> {
  const targetAbs = path.resolve(process.cwd(), opts.targetPath);
  const present = await existingKitPaths(targetAbs);

  if (present.length === 0) {
    log.info(`No ccsk kit files found in ${targetAbs}.`);
  } else if (await confirmRemoveFiles(targetAbs, opts)) {
    const result = await removeKit(targetAbs, { purgeMemory: opts.purgeMemory });
    if (result.removed.length > 0) log.success(`Removed: ${result.removed.join(', ')}`);
    if (result.backupDir) {
      log.warn(`User memory moved to ${pc.bold(path.relative(targetAbs, result.backupDir))} (not deleted).`);
    }
    if (result.preserved.length > 0) {
      log.info(`Preserved user memory: ${result.preserved.join(', ')}`);
      log.dim('    (use --purge-memory to remove it; it will be backed up first)');
    }
  } else {
    cancel('Cancelled — nothing was removed.');
    return;
  }

  // Remove the Claude Code plugin + marketplace installed by `ccsk init`.
  const plugin = await removeCcskPlugin();
  if (plugin.status === 'ok') log.success(`Removed ${plugin.name} (${plugin.detail})`);

  if (await confirmRemoveTools(opts.yes)) {
    await removeTools();
  }

  if (await confirmRemoveCcsk(opts.yes)) {
    await removeCcsk(opts.yes);
  }
}

async function confirmRemoveFiles(targetAbs: string, opts: UninstallOptions): Promise<boolean> {
  const scaffold = (await existingKitPaths(targetAbs)).filter((p) =>
    (SCAFFOLD_PATHS as readonly string[]).includes(p),
  );
  const memory = await existingUserMemoryPaths(targetAbs);

  log.warn(`This will delete the kit scaffold: ${scaffold.join(', ') || '(none)'}`);
  if (opts.purgeMemory && memory.length > 0) {
    log.warn(`--purge-memory: user memory will be backed up then removed: ${memory.join(', ')}`);
  } else if (memory.length > 0) {
    log.info(`User memory is PRESERVED: ${memory.join(', ')}`);
  }

  if (opts.yes) return true;
  const answer = await confirm({ message: 'Proceed?', initialValue: true });
  return !isCancel(answer) && answer === true;
}

async function confirmRemoveTools(yes: boolean): Promise<boolean> {
  log.warn('RTK-AI, context-mode, and Serena are installed globally and may be used by other projects.');
  if (yes) return false; // never auto-remove globally-shared tools
  const answer = await confirm({
    message: 'Also uninstall RTK-AI, context-mode, and Serena?',
    initialValue: false,
  });
  return !isCancel(answer) && answer === true;
}

async function confirmRemoveCcsk(yes: boolean): Promise<boolean> {
  if (yes) return false; // never auto-remove ccsk itself
  const answer = await confirm({
    message: 'Also uninstall ccsk CLI globally?',
    initialValue: false,
  });
  return !isCancel(answer) && answer === true;
}

/** Best-effort, non-fatal removal of the globally-installed tools. */
async function removeTools(): Promise<void> {
  if (await binExists('claude')) {
    for (const args of [
      ['mcp', 'remove', 'context-mode'],
      ['mcp', 'remove', 'serena'],
      ['mcp', 'remove', '--scope', 'user', 'serena'],
    ]) {
      const { exitCode } = await execa('claude', args, { reject: false });
      if (exitCode === 0) log.success(`Removed ${args[args.length - 1]} MCP`);
    }
  }
  log.dim('    Remove the plugin inside Claude Code: /plugin uninstall context-mode@context-mode');

  if (await binExists('rtk')) {
    const tool = (await binExists('brew')) ? 'brew' : (await binExists('cargo')) ? 'cargo' : null;
    if (tool) {
      const { exitCode } = await execa(tool, ['uninstall', 'rtk'], { reject: false });
      log[exitCode === 0 ? 'success' : 'warn'](
        exitCode === 0 ? `Uninstalled rtk via ${tool}` : `Could not uninstall rtk via ${tool}`,
      );
    } else {
      log.warn('rtk is installed but no brew/cargo found to remove it (skipped).');
    }
  }

  if (await binExists('uv')) {
    const { exitCode } = await execa('uv', ['tool', 'uninstall', 'serena-agent'], { reject: false });
    log[exitCode === 0 ? 'success' : 'warn'](
      exitCode === 0 ? 'Uninstalled serena-agent via uv' : 'Could not uninstall serena-agent (skipped)',
    );
  }
}

/**
 * Detect the package manager that owns `@ccsk/cli` and remove it, then offer to
 * wipe `~/.ccsk` (license key + kit cache). Falls back to printing the exact
 * manual command for the user's platform when automatic removal fails.
 */
async function removeCcsk(yes: boolean): Promise<void> {
  if (!(await binExists('ccsk'))) {
    log.info('ccsk is not on PATH — nothing to uninstall.');
    await maybeWipeLocalState(yes);
    return;
  }

  const result = await removeCcskGlobally();

  if (result.ok && result.via) {
    log.success(`Uninstalled ${CCSK_PACKAGE_NAME} via ${result.via}`);
  } else {
    log.warn(`Could not uninstall ${CCSK_PACKAGE_NAME} automatically.`);
    if (result.attempted.length > 0) {
      log.dim(`    Tried: ${result.attempted.join(', ')}`);
    }
    log.dim('    Manual fallback (run any one that matches how you installed):');
    log.dim(`      npm uninstall -g ${CCSK_PACKAGE_NAME}`);
    log.dim(`      pnpm remove -g ${CCSK_PACKAGE_NAME}`);
    log.dim(`      yarn global remove ${CCSK_PACKAGE_NAME}`);
    log.dim(`      bun remove -g ${CCSK_PACKAGE_NAME}`);
  }

  await maybeWipeLocalState(yes);
}

/**
 * Optionally delete `~/.ccsk` (license key + cached kit tarballs). Off by
 * default so a reinstall doesn't force the user to re-enter their license key.
 */
async function maybeWipeLocalState(yes: boolean): Promise<void> {
  if (!fs.existsSync(CCSK_HOME)) return;
  if (yes) return; // never auto-wipe license/cache in non-interactive mode

  const answer = await confirm({
    message: `Also delete saved license key and kit cache (${CCSK_HOME})?`,
    initialValue: false,
  });
  if (isCancel(answer) || answer !== true) return;

  try {
    fs.rmSync(CCSK_HOME, { recursive: true, force: true });
    log.success(`Removed ${CCSK_HOME}`);
  } catch (err) {
    log.warn(`Could not remove ${CCSK_HOME}: ${(err as Error).message}`);
  }
}
