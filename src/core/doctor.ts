/**
 * ccsk doctor — diagnostic checks for a broken install / environment.
 *
 * Each check is a pure mapping from an injected probe value to a DiagnosticResult.
 * Checks NEVER throw and NEVER call process.exit — the command (commands/doctor.ts)
 * renders the report and sets the exit code. Probes are injectable so the checks
 * are unit-testable without touching the real environment or network.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { detectAuthMethod } from './github-auth.js';
import { binExists } from '../util/platform.js';

export type DiagnosticStatus = 'pass' | 'warn' | 'fail';

export interface DiagnosticResult {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  hint?: string;
}

export interface DiagnosticReport {
  results: DiagnosticResult[];
  ok: boolean;
}

/** Injectable environment probes — real implementations live in `realProbes()`. */
export interface DoctorProbes {
  /** Running Node version, e.g. process.versions.node ("20.11.0"). */
  nodeVersion: string;
  /** Whether `git` is resolvable on PATH. */
  gitAvailable: () => Promise<boolean>;
  /** Own package.json version, or null if unreadable (corrupt install). */
  readCliVersion: () => string | null;
  /** Best available GitHub auth method. */
  detectAuth: () => Promise<{ method: 'ssh' | 'gh' | 'none' }>;
  /** Readability of the kit cache dir: present+readable, present+unreadable, or absent. */
  cacheReadable: () => 'ok' | 'unreadable' | 'absent';
}

const MIN_NODE_MAJOR = 20;

/** Kit cache dir — kept in sync with kit-cache.ts (not exported there). */
function kitDir(): string {
  return path.join(os.homedir(), '.ccsk', 'kit');
}

function realReadCliVersion(): string | null {
  try {
    const pkgUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(fileURLToPath(pkgUrl), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function realCacheReadable(): 'ok' | 'unreadable' | 'absent' {
  const dir = kitDir();
  if (!fs.existsSync(dir)) return 'absent';
  try {
    fs.readdirSync(dir);
    return 'ok';
  } catch {
    return 'unreadable';
  }
}

/** The production probe set — reads the real environment. */
export function realProbes(): DoctorProbes {
  return {
    nodeVersion: process.versions.node,
    gitAvailable: () => binExists('git'),
    readCliVersion: realReadCliVersion,
    detectAuth: async () => detectAuthMethod(),
    cacheReadable: realCacheReadable,
  };
}

function checkNodeVersion(version: string): DiagnosticResult {
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
  const ok = major >= MIN_NODE_MAJOR;
  return {
    id: 'node-version',
    label: 'Node version',
    status: ok ? 'pass' : 'fail',
    detail: `Node v${version}`,
    hint: ok ? undefined : `ccsk needs Node >= ${MIN_NODE_MAJOR}. Upgrade Node and retry.`,
  };
}

function checkGit(available: boolean): DiagnosticResult {
  return {
    id: 'git',
    label: 'git on PATH',
    status: available ? 'pass' : 'fail',
    detail: available ? 'git found' : 'git not found on PATH',
    hint: available ? undefined : 'Install git — kits are cloned with it. See https://git-scm.com/downloads',
  };
}

function checkCliVersion(version: string | null): DiagnosticResult {
  return {
    id: 'cli-version',
    label: 'ccsk install',
    status: version ? 'pass' : 'fail',
    detail: version ? `ccsk v${version}` : 'cannot read ccsk package.json',
    hint: version ? undefined : 'Install looks corrupt. Reinstall: npm i -g @ccsk/cli@latest',
  };
}

function checkGithubAuth(method: 'ssh' | 'gh' | 'none'): DiagnosticResult {
  const ok = method !== 'none';
  return {
    id: 'github-auth',
    label: 'GitHub auth',
    status: ok ? 'pass' : 'warn',
    detail: ok ? `authenticated via ${method.toUpperCase()}` : 'no SSH or gh authentication',
    hint: ok ? undefined : 'Needed to download kits. Run `ccsk auth` for setup steps.',
  };
}

function checkKitCache(state: 'ok' | 'unreadable' | 'absent'): DiagnosticResult {
  const ok = state !== 'unreadable';
  return {
    id: 'kit-cache',
    label: 'Kit cache',
    status: ok ? 'pass' : 'fail',
    detail: state === 'ok' ? 'cache readable' : state === 'absent' ? 'no cache yet' : 'cache exists but is not readable',
    hint: ok ? undefined : 'Fix permissions on ~/.ccsk/kits, or run `ccsk cache --clear-all`.',
  };
}

/**
 * Run every diagnostic check and aggregate. `report.ok` is true iff no check
 * failed (warnings do not flip it). Pass `probes` to override any environment
 * read — production callers omit it to use the real environment.
 */
export async function runDiagnostics(probes?: Partial<DoctorProbes>): Promise<DiagnosticReport> {
  const p: DoctorProbes = { ...realProbes(), ...probes };

  const results: DiagnosticResult[] = [
    checkNodeVersion(p.nodeVersion),
    checkGit(await p.gitAvailable()),
    checkCliVersion(p.readCliVersion()),
    checkGithubAuth((await p.detectAuth()).method),
    checkKitCache(p.cacheReadable()),
  ];

  return { results, ok: results.every((r) => r.status !== 'fail') };
}
