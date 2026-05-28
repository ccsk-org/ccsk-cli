/**
 * Cross-platform Node package-manager helper.
 *
 * Used by `ccsk uninstall` to remove the globally-installed `@ccsk/cli`. The
 * flow is: detect which PM owns the package, run that PM's remove command,
 * then re-check the binary to confirm. Falls back to trying every supported PM
 * in order when detection is inconclusive.
 *
 * Cross-OS notes:
 *   - `execa` is always called with array args (no shell). Safe from injection
 *     even if a future caller passes the package name through a variable.
 *   - `binExists()` uses `where` on Windows and `which` elsewhere.
 *   - PM-specific list commands write to stdout; we string-match the package
 *     name rather than parsing structured output, since each PM (and each
 *     version of each PM) prints a different format.
 */

import { execa } from 'execa';
import { binExists } from '../util/platform.js';

export const CCSK_PACKAGE_NAME = '@ccsk/cli';

export type PkgManagerId = 'npm' | 'pnpm' | 'yarn' | 'bun';

interface PkgManagerSpec {
  id: PkgManagerId;
  bin: string;
  listArgs: string[];
  removeArgs: (pkg: string) => string[];
}

// Ordered by likelihood for the typical Node toolchain. `npm` first because
// it ships with every Node install; `bun` last because it's the newest.
const MANAGERS: readonly PkgManagerSpec[] = [
  {
    id: 'npm',
    bin: 'npm',
    listArgs: ['ls', '-g', '--depth=0', '--parseable=false'],
    removeArgs: (pkg) => ['uninstall', '-g', pkg],
  },
  {
    id: 'pnpm',
    bin: 'pnpm',
    listArgs: ['ls', '-g', '--depth=0'],
    removeArgs: (pkg) => ['remove', '-g', pkg],
  },
  {
    id: 'yarn',
    bin: 'yarn',
    // Yarn 1 only — Yarn 2+ removed `yarn global`. Probing fails cleanly there.
    listArgs: ['global', 'list', '--depth=0'],
    removeArgs: (pkg) => ['global', 'remove', pkg],
  },
  {
    id: 'bun',
    bin: 'bun',
    listArgs: ['pm', 'ls', '-g'],
    removeArgs: (pkg) => ['remove', '-g', pkg],
  },
];

async function isOwnedBy(spec: PkgManagerSpec, pkg: string): Promise<boolean> {
  if (!(await binExists(spec.bin))) return false;
  const { exitCode, stdout, stderr } = await execa(spec.bin, spec.listArgs, {
    reject: false,
    timeout: 15_000,
  });
  if (exitCode !== 0) return false;
  return `${stdout}\n${stderr}`.includes(pkg);
}

/** Identify which package manager has `@ccsk/cli` installed globally, if any. */
export async function detectCcskOwner(): Promise<PkgManagerSpec | null> {
  for (const spec of MANAGERS) {
    if (await isOwnedBy(spec, CCSK_PACKAGE_NAME)) return spec;
  }
  return null;
}

export interface RemoveResult {
  ok: boolean;
  via: PkgManagerId | null;
  attempted: PkgManagerId[];
}

/**
 * Remove `@ccsk/cli` globally. Tries the detected owner first; if that fails
 * (or no owner could be detected), walks every available manager in order.
 * Returns the manager that ultimately succeeded, plus the full attempt log.
 */
export async function removeCcskGlobally(): Promise<RemoveResult> {
  const attempted: PkgManagerId[] = [];

  const tryRemove = async (spec: PkgManagerSpec): Promise<boolean> => {
    if (!(await binExists(spec.bin))) return false;
    attempted.push(spec.id);
    const { exitCode } = await execa(spec.bin, spec.removeArgs(CCSK_PACKAGE_NAME), {
      reject: false,
      timeout: 60_000,
    });
    if (exitCode !== 0) return false;
    return !(await binExists('ccsk'));
  };

  const owner = await detectCcskOwner();
  if (owner && (await tryRemove(owner))) {
    return { ok: true, via: owner.id, attempted };
  }

  for (const spec of MANAGERS) {
    if (spec.id === owner?.id) continue; // already tried
    if (await tryRemove(spec)) {
      return { ok: true, via: spec.id, attempted };
    }
  }

  return { ok: false, via: null, attempted };
}
