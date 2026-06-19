/**
 * ccsk init — confirm, fetch kit from GitHub, copy to target, prompt donate.
 * Single kit architecture: no kit selection, no license gating.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirm, isCancel, cancel } from '@clack/prompts';
import { ensureGitHubAuth } from '../core/github-auth.js';
import { fetchKit, KIT_LABEL } from '../core/kit-fetcher.js';
import { copyKit } from '../core/copy-kit.js';
import { registerInstall } from '../core/install-tracker.js';
import { promptDonateAfterInit } from '../core/donation.js';
import { runSetup } from '../core/setup-runner.js';
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
  force?: boolean;
}

export async function runInit(opts: InitOptions): Promise<void> {
  printBanner({ ...BANNER_META, version: readVersion() });

  // 1. Confirm installation
  if (!opts.yes) {
    const shouldInstall = await confirm({
      message: `Install ${KIT_LABEL}?`,
      initialValue: true,
    });

    if (isCancel(shouldInstall) || !shouldInstall) {
      cancel('Cancelled — no files were written.');
      return;
    }
  }

  // 2. Ensure GitHub auth (required to clone kit repo)
  const auth = await ensureGitHubAuth();
  if (auth.method === 'none') {
    process.exit(1);
  }

  // 3. Fetch kit (from cache or clone)
  const fetchResult = await fetchKit({
    version: opts.version,
    force: opts.force,
  });

  if (!fetchResult.success) {
    log.error(fetchResult.error ?? 'Failed to fetch kit');
    process.exit(1);
  }

  // 4. Register install (capture GitHub + optional email for tracking)
  await registerInstall(fetchResult.version);

  // 5. Confirm overwrite and copy
  const targetAbs = path.resolve(process.cwd(), opts.targetPath);

  if (!(await confirmOverwrite(targetAbs, opts.yes))) {
    cancel('Cancelled — no files were written.');
    return;
  }

  log.step(`Installing kit v${fetchResult.version} into ${targetAbs}`);
  const written = await copyKit(fetchResult.cachePath, targetAbs);
  log.success(`Copied: ${written.join(', ')}`);

  // 6. Sync the ccsk-managed .gitignore block
  const gitignoreAction = ensureCcskGitignoreBlock(targetAbs);
  log.success(`Synced .gitignore (${gitignoreAction} ccsk-managed block)`);

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
  printNextSteps(targetAbs, addInstalled);

  // 9. Prompt for donation (only in interactive mode)
  if (!opts.yes) {
    log.info('');
    await promptDonateAfterInit();
  }
}

function printNextSteps(targetAbs: string, addInstalled: boolean): void {
  const rel = path.relative(process.cwd(), targetAbs) || '.';
  log.info('');
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

async function confirmOverwrite(targetAbs: string, yes: boolean): Promise<boolean> {
  if (yes) return true;

  if (fs.existsSync(targetAbs)) {
    const entries = fs.readdirSync(targetAbs);
    const kitFiles = entries.filter((e) =>
      e === 'CLAUDE.md' || e === '.claude' || e === '.mcp.json' || e === 'docs'
    );

    if (kitFiles.length > 0) {
      log.warn(`Target already contains kit files: ${kitFiles.join(', ')}`);
      const answer = await confirm({ message: 'Overwrite them?', initialValue: true });
      return !isCancel(answer) && answer === true;
    }
  }

  return true;
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
