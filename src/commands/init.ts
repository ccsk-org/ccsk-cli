/**
 * ccsk init — confirm, fetch kit from GitHub, copy to target, prompt donate.
 * Single kit architecture: no kit selection, no license gating.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirm, select, isCancel, cancel } from '@clack/prompts';
import { ensureGitHubAuth, type AuthStatus } from '../core/github-auth.js';
import {
  fetchKit,
  listAvailableVersions,
  resolveLatestStable,
  resolveLatestPrerelease,
} from '../core/kit-fetcher.js';
import { copyKit, findConflicts, type ConflictPolicy } from '../core/copy-kit.js';
import { listCachedVersions } from '../core/kit-cache.js';
import { pickKitVersion } from '../util/version-picker.js';
import { registerInstall } from '../core/install-tracker.js';
import { promptDonateAfterInit } from '../core/donation.js';
import { runSetup } from '../core/setup-runner.js';
import { installCcskPlugin, type PluginScope } from '../core/plugin-install.js';
import { ensureAdd } from '../core/add.js';
import { runDesignSetup } from './design.js';
import { printBanner } from '../util/banner.js';
import { ensureCcskGitignoreBlock } from '../util/gitignore-sync.js';
import { log, pc } from '../util/log.js';

const BANNER_META = {
  slogan: 'Claude Code Starter Kit — scaffold Claude-ready projects in one command.',
  author: 'Crystal D.',
  contributors: 'E.Wallis, TinDang',
  organization: 'Trustify Technology JSC · US',
} as const;

function readVersion(): string {
  try {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export interface InitOptions {
  targetPath: string;
  setup: boolean;
  add: boolean;
  yes: boolean;
  version?: string;
  /** Opt into prereleases when resolving "latest". */
  pre?: boolean;
  force?: boolean;
  /** Install the ccsk Claude Code plugin after materializing templates. */
  plugin?: boolean;
  /** Plugin install scope. Defaults to `project` so it travels with the repo. */
  pluginScope?: PluginScope;
}

export async function runInit(opts: InitOptions): Promise<void> {
  printBanner({ ...BANNER_META, version: readVersion() });

  // 1. Ensure GitHub auth (required to list/clone the kit repo)
  const auth = await ensureGitHubAuth();
  if (auth.method === 'none') {
    process.exit(1);
  }

  // 2. Resolve which kit version to install (picker / flags). In interactive
  //    mode the picker IS the install consent, replacing the plain confirm.
  const resolution = await resolveVersion(opts, auth);
  if (resolution.kind === 'cancel') {
    cancel('Cancelled — no files were written.');
    return;
  }
  if (resolution.kind === 'fail') {
    log.error(resolution.message);
    process.exit(1);
  }
  const requestedVersion = resolution.kind === 'use' ? resolution.version : undefined;
  const pickedInteractively = resolution.kind === 'use' && !opts.version && isInteractive(opts);

  // 3. Fetch kit (from cache or clone). On a "not found" in interactive mode,
  //    reopen the picker ONCE before giving up.
  let fetchResult = await fetchKit({ version: requestedVersion, force: opts.force });
  if (
    !fetchResult.success &&
    pickedInteractively &&
    (fetchResult.error?.includes('not found') ?? false)
  ) {
    log.warn(fetchResult.error ?? 'Version not found.');
    const retry = await resolveVersion(opts, auth);
    if (retry.kind === 'cancel') {
      cancel('Cancelled — no files were written.');
      return;
    }
    if (retry.kind === 'use') {
      fetchResult = await fetchKit({ version: retry.version, force: opts.force });
    }
  }

  if (!fetchResult.success) {
    log.error(fetchResult.error ?? 'Failed to fetch kit');
    process.exit(1);
  }

  const isPrerelease = fetchResult.version.includes('-');
  if (isPrerelease) {
    log.warn(`Installing a PRERELEASE kit (v${fetchResult.version}) — it may be unstable.`);
  }

  // 4. Register install (capture GitHub + optional email for tracking)
  await registerInstall(fetchResult.version);

  // 5. Detect conflicts, pick a non-destructive policy, then copy
  const targetAbs = path.resolve(process.cwd(), opts.targetPath);

  const conflicts = await findConflicts(fetchResult.cachePath, targetAbs);
  const policy = await resolveConflictPolicy(conflicts, isInteractive(opts));
  if (policy === null) {
    cancel('Cancelled — no files were written.');
    return;
  }

  log.step(`Installing kit v${fetchResult.version} into ${targetAbs}`);
  const written = await copyKit(fetchResult.cachePath, targetAbs, { onConflict: policy });
  log.success(`Copied: ${written.topLevel.join(', ')}`);
  if (written.backedUp.length > 0) {
    log.info(`Backed up ${written.backedUp.length} existing file(s) to *.bak before overwriting.`);
  }
  if (written.kept.length > 0) {
    log.info(
      `Kept ${written.kept.length} existing file(s); ccsk versions written alongside as *.ccsk.bak.`,
    );
  }

  // 6. Sync the ccsk-managed .gitignore block
  const gitignoreAction = ensureCcskGitignoreBlock(targetAbs);
  log.success(`Synced .gitignore (${gitignoreAction} ccsk-managed block)`);

  // 6b. Install the Claude Code plugin (non-aborting step). Pin the marketplace
  // to the local cache path we just cloned at this exact version.
  if (opts.plugin !== false) {
    log.step('Installing ccsk Claude Code plugin');
    const scope: PluginScope = opts.pluginScope ?? 'project';
    const result = await installCcskPlugin({ source: fetchResult.cachePath, scope });
    const icon =
      result.status === 'ok'
        ? pc.green('✓')
        : result.status === 'skipped'
          ? pc.yellow('–')
          : pc.red('✗');
    const detail = result.detail ? pc.dim(` (${result.detail})`) : '';
    console.log(`  ${icon} ${result.name}${detail}`);
    if (result.status === 'skipped' && result.detail?.includes('claude CLI not found')) {
      log.dim('    Install Claude Code, then re-run `ccsk init` to add the plugin.');
    }
  }

  // 7. Optional ADD installation
  let addInstalled = false;
  if (opts.add && (opts.yes || await confirmAddInstall())) {
    const result = await ensureAdd(targetAbs);
    const icon = result.status === 'ok' ? pc.green('✓') : pc.red('✗');
    const detail = result.detail ? pc.dim(` (${result.detail})`) : '';
    console.log(`  ${icon} ${result.name}${detail}`);
    addInstalled = result.status === 'ok';
  }

  // 8. Optional tool setup
  if (opts.setup && (opts.yes || await confirmSetup())) {
    await runSetup(targetAbs);
  }

  // 9. Optional design reference
  await runDesignSetup({ targetPath: targetAbs, yes: opts.yes });

  log.success('Done. Open the project in Claude Code to get started.');
  printNextSteps(targetAbs, addInstalled, isPrerelease);

  // 9. Prompt for donation (only in interactive mode)
  if (!opts.yes) {
    log.info('');
    await promptDonateAfterInit();
  }
}

/** Discriminated result of version resolution. */
type VersionResolution =
  | { kind: 'use'; version: string }
  | { kind: 'auto' } // let fetchKit resolve (interactive, but listing failed)
  | { kind: 'cancel' }
  | { kind: 'fail'; message: string };

/** Interactive iff TTY, not `--yes`, and not running in CI. */
function isInteractive(opts: InitOptions): boolean {
  return !opts.yes && !!process.stdout.isTTY && !process.env.CI;
}

/**
 * Resolve the kit version to install, sitting BETWEEN auth and fetchKit:
 *   - explicit `--version` wins (no picker);
 *   - non-interactive: latest stable (or latest incl. prerelease with `--pre`);
 *     no stable + no `--pre` is a hard, explicit failure;
 *   - interactive: show the version picker (which doubles as install consent);
 *     an empty listing falls through to fetchKit's own resolution.
 */
export async function resolveVersion(
  opts: InitOptions,
  _auth: AuthStatus,
): Promise<VersionResolution> {
  if (opts.version) return { kind: 'use', version: opts.version };

  if (!isInteractive(opts)) {
    if (opts.pre) {
      const pre = await resolveLatestPrerelease();
      if (pre) return { kind: 'use', version: pre };
      return {
        kind: 'fail',
        message: 'No kit release found — pass `--version <x>`, or run `ccsk versions`.',
      };
    }
    const stable = await resolveLatestStable();
    if (stable) return { kind: 'use', version: stable };
    return {
      kind: 'fail',
      message:
        'No stable kit release yet — pass `--version <x>` or `--pre`, or run `ccsk versions`.',
    };
  }

  // Interactive: list and let the user pick.
  const versions = await listAvailableVersions();
  if (versions.length === 0) return { kind: 'auto' };

  const latestStable = versions.find((v) => !v.prerelease)?.version ?? null;
  if (!latestStable) {
    log.warn('No stable kit release yet — defaulting to the newest prerelease.');
  }

  const cached = new Set(listCachedVersions().map((c) => c.version));
  const chosen = await pickKitVersion({ versions, cached, latestStable });
  if (chosen === null) return { kind: 'cancel' };
  return { kind: 'use', version: chosen };
}

function printNextSteps(targetAbs: string, addInstalled: boolean, isPrerelease: boolean): void {
  const rel = path.relative(process.cwd(), targetAbs) || '.';
  log.info('');
  if (isPrerelease) {
    log.warn('You are on a prerelease channel. Run `ccsk update` to move to the latest stable.');
    log.info('');
  }
  log.info('Next:');
  log.info(`  cd ${rel}`);
  log.info('  claude                       # open Claude Code in this project');
  log.info('  /scaffold <one-line>         # → tech-stacks, architecture, docs, plan');

  if (addInstalled) {
    log.info('');
    log.info('ADD Quick Start:');
    log.info('  /add setup project           # initialize ADD for this project');
  }

  log.info('');
  log.hint('Examples: `/scaffold B2B HR SaaS for VN SMEs` · `/scaffold` (no args = interview-only)');
}

/**
 * Decides — non-destructively — how to handle shipped files that already exist
 * in the target. Returns the chosen {@link ConflictPolicy}, or `null` if the
 * user cancelled.
 *
 * - No conflicts → `'backup'` (a no-op; nothing to back up).
 * - Non-interactive (`--yes` / non-TTY / CI) → `'backup'` (safe default: never destroys files).
 * - Interactive → a three-way prompt (Overwrite with backup / Keep mine / Cancel).
 */
async function resolveConflictPolicy(
  conflicts: string[],
  interactive: boolean,
): Promise<ConflictPolicy | null> {
  if (conflicts.length === 0) return 'backup';
  if (!interactive) return 'backup';

  log.warn(`${conflicts.length} existing file(s) would be replaced by the kit:`);
  for (const c of conflicts.slice(0, 8)) log.dim(`  • ${c}`);
  if (conflicts.length > 8) log.dim(`  …and ${conflicts.length - 8} more`);

  const choice = await select({
    message: 'How should ccsk handle these?',
    options: [
      { value: 'backup', label: 'Overwrite — back up mine to *.bak, then install ccsk' },
      { value: 'keep', label: 'Keep mine — install ccsk alongside as *.ccsk.bak' },
      { value: 'cancel', label: 'Cancel — write nothing' },
    ],
    initialValue: 'backup',
  });

  if (isCancel(choice) || choice === 'cancel') return null;
  return choice as ConflictPolicy;
}

async function confirmAddInstall(): Promise<boolean> {
  const answer = await confirm({
    message: 'Install ADD (AI-Driven Development)?',
    initialValue: true,
  });
  return !isCancel(answer) && answer === true;
}

async function confirmSetup(): Promise<boolean> {
  const answer = await confirm({
    message: 'Run tool setup (RTK-AI + context-mode)?',
    initialValue: true,
  });
  return !isCancel(answer) && answer === true;
}
