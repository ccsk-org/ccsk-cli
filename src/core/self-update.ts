/**
 * Self-update logic for the ccsk CLI.
 *
 * Detects the package manager that owns the global install and runs the
 * appropriate `add/install -g` command. Streams stdio to the user so they
 * see the installer's progress directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { log } from '../util/log.js';

const PKG_NAME = '@ccsk/cli';

/**
 * Minimum CLI version users are allowed to self-install via `ccsk update <ver>`.
 * Older releases shipped behaviour that is now considered broken or incompatible
 * with the current kit repositories (stale kit cache, bad settings.local.json,
 * missing license model, oversized payment QRs). Pinning the floor here keeps
 * users from accidentally downgrading into those known-bad states.
 */
const MIN_SUPPORTED_VERSION = '1.0.7';

type PkgManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

function readCurrentVersion(): string {
  try {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'package.json'), 'utf8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function detectPackageManager(): PkgManager {
  const ua = (process.env.npm_config_user_agent ?? '').toLowerCase();
  if (ua.startsWith('bun')) return 'bun';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';

  const execPath = (process.env.npm_execpath ?? process.execPath ?? '').toLowerCase();
  if (execPath.includes('bun')) return 'bun';
  if (execPath.includes('pnpm')) return 'pnpm';
  if (execPath.includes('yarn')) return 'yarn';

  return 'npm';
}

function buildInstallArgs(pm: PkgManager, spec: string): { bin: string; args: string[] } {
  switch (pm) {
    case 'pnpm':
      return { bin: 'pnpm', args: ['add', '-g', spec] };
    case 'yarn':
      return { bin: 'yarn', args: ['global', 'add', spec] };
    case 'bun':
      return { bin: 'bun', args: ['add', '-g', spec] };
    case 'npm':
    default:
      return { bin: 'npm', args: ['install', '-g', spec] };
  }
}

function isValidVersion(v: string): boolean {
  // Accept "latest", "next", semver-ish strings, dist-tags.
  return /^[a-zA-Z0-9._-]+$/.test(v);
}

/**
 * Parses a strict `MAJOR.MINOR.PATCH` semver into a numeric tuple.
 * Returns null for dist-tags ("latest", "next") or any non-strict form,
 * which callers should treat as "not subject to the version floor".
 */
function parseSemverTriplet(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isBelowMinSupported(requested: string): boolean {
  const reqTriplet = parseSemverTriplet(requested);
  if (!reqTriplet) return false; // dist-tags pass through
  const minTriplet = parseSemverTriplet(MIN_SUPPORTED_VERSION);
  if (!minTriplet) return false;
  for (let i = 0; i < 3; i++) {
    if (reqTriplet[i] < minTriplet[i]) return true;
    if (reqTriplet[i] > minTriplet[i]) return false;
  }
  return false; // equal → allowed
}

export async function runSelfUpdate(opts: { version: string }): Promise<void> {
  const requested = (opts.version || 'latest').trim();
  if (!isValidVersion(requested)) {
    throw new Error(`invalid version: ${requested}`);
  }

  if (isBelowMinSupported(requested)) {
    throw new Error(
      `ccsk v${requested} is no longer supported. ` +
      `The minimum supported version is v${MIN_SUPPORTED_VERSION}. ` +
      `Try \`ccsk update latest\` or pin a version >= v${MIN_SUPPORTED_VERSION}.`,
    );
  }

  const before = readCurrentVersion();
  const pm = detectPackageManager();
  const spec = `${PKG_NAME}@${requested}`;
  const { bin, args } = buildInstallArgs(pm, spec);

  log.info(`current version: ${before}`);
  log.step(`updating via ${pm}: ${bin} ${args.join(' ')}`);

  try {
    await execa(bin, args, { stdio: 'inherit' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`update failed: ${msg}`);
    log.hint(`run manually: ${bin} ${args.join(' ')}`);
    throw new Error('ccsk update failed');
  }

  try {
    const { stdout } = await execa('ccsk', ['--version'], { reject: false });
    const after = stdout?.trim() || 'unknown';
    log.success(`updated: ${before} → ${after}`);
  } catch {
    log.success(`update command completed (run \`ccsk --version\` to verify)`);
  }
}
