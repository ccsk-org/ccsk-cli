/**
 * Install tracking — capture GitHub username + optional email for owner visibility.
 * No access gating. Always succeeds. Records who installed the kit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { isCancel, text } from '@clack/prompts';
import { log } from '../util/log.js';
import { homeDir } from '../util/platform.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { detectAuthMethod } from './github-auth.js';

const SUPABASE_URL = 'https://qorrssuqkblahzzlonhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iYy5ExmiYqVIwxCD3e5SqQ_E1VNLSKK';

export interface InstallRecord {
  github_username: string | null;
  email: string | null;
  kit_version: string;
}

/** Locally-persisted record of the currently-installed kit version/channel. */
export interface InstalledVersionRecord {
  version: string;
  channel: 'stable' | 'pre';
  installedAt: string;
}

/** Local state file: ~/.ccsk/install.json (separate from telemetry POST). */
function installStatePath(): string {
  return path.join(homeDir(), '.ccsk', 'install.json');
}

/**
 * Persist the installed kit version/channel locally so `update` and `versions`
 * can report "current". Best-effort — never throws.
 */
export function recordInstalledVersion(version: string): void {
  try {
    const record: InstalledVersionRecord = {
      version,
      channel: version.includes('-') ? 'pre' : 'stable',
      installedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(installStatePath()), { recursive: true });
    fs.writeFileSync(installStatePath(), JSON.stringify(record, null, 2), 'utf8');
  } catch {
    // Best-effort — local bookkeeping must never block an install.
  }
}

/** Read the locally-persisted installed version, or null if absent/corrupt. */
export function readInstalledVersion(): InstalledVersionRecord | null {
  try {
    const raw = fs.readFileSync(installStatePath(), 'utf8');
    const parsed = JSON.parse(raw) as InstalledVersionRecord;
    return parsed && typeof parsed.version === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function resolveGitHubUsername(): Promise<string | null> {
  const status = await detectAuthMethod();
  return status.username ?? null;
}

async function promptOptionalEmail(): Promise<string | null> {
  const input = await text({
    message: 'Want updates? Enter your email (optional, press Enter to skip):',
    placeholder: 'you@example.com',
    validate: (value) => {
      if (!value) return; // empty is valid (optional)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return 'Please enter a valid email address or leave empty.';
      }
    },
  });

  if (isCancel(input) || !input) return null;
  return (input as string).trim().toLowerCase();
}

/**
 * Register an install with the backend for tracking.
 * This is fire-and-forget — failure doesn't block installation.
 */
async function sendInstallRecord(record: InstallRecord): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/register-install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(5_000),
    });

    return res.ok;
  } catch {
    // Network errors are silently ignored — don't block installation
    return false;
  }
}

/**
 * Register the installation. Captures GitHub username silently,
 * prompts for optional email, sends to backend for tracking.
 * Never blocks installation — tracking is best-effort.
 */
export async function registerInstall(kitVersion: string): Promise<void> {
  // Persist locally first so `update`/`versions` can read "current" even if
  // telemetry is skipped or offline.
  recordInstalledVersion(kitVersion);

  const githubUsername = await withShimmer('Detecting GitHub identity…', resolveGitHubUsername);

  if (githubUsername) {
    log.info(`GitHub: @${githubUsername}`);
  }

  const email = await promptOptionalEmail();

  const record: InstallRecord = {
    github_username: githubUsername,
    email,
    kit_version: kitVersion,
  };

  // Fire and forget — don't block on tracking
  sendInstallRecord(record).then((ok) => {
    if (!ok && process.env.CCSK_DEBUG) {
      log.warn('Could not record install (debug mode)');
    }
  });
}

/**
 * Get GitHub username for display purposes.
 */
export async function getGitHubUsername(): Promise<string | null> {
  return resolveGitHubUsername();
}
