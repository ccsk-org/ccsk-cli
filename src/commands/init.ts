/**
 * ccsk init — select kit, validate license, fetch from GitHub, copy to target.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, confirm, isCancel, cancel } from '@clack/prompts';
import { KIT_REGISTRY, getKitMeta, getEnabledKits, isKitEnabled, type KitMeta } from '../core/kit-registry.js';
import { validateLicenseForKit } from '../core/license.js';
import { ensureGitHubAuth } from '../core/github-auth.js';
import { fetchKit } from '../core/kit-fetcher.js';
import { copyKit } from '../core/copy-kit.js';
import { runSetup } from '../core/setup-runner.js';
import { printBanner } from '../util/banner.js';
import { log } from '../util/log.js';

const BANNER_META = {
  slogan: 'Claude Code Starter Kit — scaffold Claude-ready projects in one command.',
  author: 'Crystal D.',
  contributors: 'E.Wallis',
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
  yes: boolean;
  kit?: string;
  version?: string;
  force?: boolean;
}

export async function runInit(opts: InitOptions): Promise<void> {
  printBanner({ ...BANNER_META, version: readVersion() });

  // 1. Select kit
  const kit = opts.kit ? getKitMeta(opts.kit) : await selectKit(opts.yes);
  if (!kit) return;

  // 2. Validate license for this kit (handles free auto-register + 3-option paid menu).
  log.step(`Validating license for ${kit.label} kit...`);
  const licenseResult = await validateLicenseForKit(kit.id);

  if (!licenseResult.valid) {
    log.info(licenseResult.reason);
    process.exit(1);
  }
  log.success('License valid');

  // 3. Ensure GitHub auth
  const auth = await ensureGitHubAuth();
  if (auth.method === 'none') {
    process.exit(1);
  }

  // 4. Fetch kit (from cache or clone)
  const fetchResult = await fetchKit(kit, {
    version: opts.version,
    force: opts.force,
  });

  if (!fetchResult.success) {
    log.error(fetchResult.error ?? 'Failed to fetch kit');
    process.exit(1);
  }

  // 5. Confirm overwrite and copy
  const targetAbs = path.resolve(process.cwd(), opts.targetPath);

  if (!(await confirmOverwrite(targetAbs, opts.yes))) {
    cancel('Cancelled — no files were written.');
    return;
  }

  log.step(`Installing "${kit.label}" kit into ${targetAbs}`);
  const written = await copyKit(fetchResult.cachePath, targetAbs);
  log.success(`Copied: ${written.join(', ')}`);

  // 6. Optional tool setup
  if (opts.setup && (opts.yes || await confirmSetup())) {
    await runSetup(targetAbs);
  }

  log.success('Done. Open the project in Claude Code to get started.');
}

async function selectKit(yes: boolean): Promise<KitMeta | null> {
  const enabledKits = getEnabledKits();

  if (yes) {
    return enabledKits[0] ?? null;
  }

  const choice = await select({
    message: 'Which kit do you want to install?',
    initialValue: 'frontend',
    options: KIT_REGISTRY.map((k) => ({
      value: k.id,
      label: `${k.label}${k.pricing === 'free' ? ' (free)' : ''}`,
      hint: isKitEnabled(k.id) ? k.description : 'coming soon',
    })),
  });

  if (isCancel(choice)) {
    cancel('Cancelled.');
    return null;
  }

  const kit = getKitMeta(choice as string);
  if (!kit || !isKitEnabled(kit.id)) {
    log.warn(`The "${kit?.label ?? choice}" kit is coming soon.`);
    return null;
  }

  return kit;
}

async function confirmOverwrite(targetAbs: string, yes: boolean): Promise<boolean> {
  if (yes) return true;

  // Check if target has existing files
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

async function confirmSetup(): Promise<boolean> {
  const answer = await confirm({
    message: 'Run tool setup (RTK-AI + context-mode)?',
    initialValue: true,
  });
  return !isCancel(answer) && answer === true;
}
