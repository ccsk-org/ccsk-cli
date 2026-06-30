import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * SCAFFOLD: kit-shipped, refreshable files that `ccsk uninstall` removes by
 * default. `.ccsk/templates` is part of the scaffold (regenerated on init) and
 * is therefore safe to remove; the rest of `.ccsk/` is USER MEMORY.
 */
export const SCAFFOLD_PATHS = [
  'CLAUDE.md',
  '.claude',
  '.mcp.json',
  'docs',
  path.join('.ccsk', 'templates'),
] as const;

/**
 * USER MEMORY: the user's durable, self-authored state under `.ccsk/` (minus
 * templates). PRESERVED by default — only `--purge-memory` removes it, and even
 * then it is backed up (moved) first, never `rm -rf`'d.
 */
export const USER_MEMORY_PATHS = [
  path.join('.ccsk', 'plans'),
  path.join('.ccsk', 'journals'),
  path.join('.ccsk', 'retros'),
  path.join('.ccsk', 'adrs'),
  path.join('.ccsk', 'milestones'),
  path.join('.ccsk', 'MEMORY.md'),
] as const;

/** All top-level/known kit paths — used to detect "is a kit installed here?". */
export const KIT_PATHS = [...SCAFFOLD_PATHS, ...USER_MEMORY_PATHS] as const;

export interface RemoveOptions {
  /** Remove USER MEMORY too (after backing it up). Default false → preserve it. */
  purgeMemory?: boolean;
}

export interface RemoveResult {
  /** Paths actually deleted from the project. */
  removed: string[];
  /** USER MEMORY paths left in place (default mode). */
  preserved: string[];
  /** Where USER MEMORY was moved to, if `--purge-memory` was used. */
  backupDir?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Returns the subset of `candidates` that currently exist under `targetAbs`. */
async function presentPaths(targetAbs: string, candidates: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const name of candidates) {
    if (await pathExists(path.join(targetAbs, name))) found.push(name);
  }
  return found;
}

/** Returns the kit paths (scaffold + memory) that currently exist in the target. */
export async function existingKitPaths(targetAbs: string): Promise<string[]> {
  return presentPaths(targetAbs, KIT_PATHS);
}

/** Returns the USER MEMORY paths currently present in the target. */
export async function existingUserMemoryPaths(targetAbs: string): Promise<string[]> {
  return presentPaths(targetAbs, USER_MEMORY_PATHS);
}

/** Timestamp suffix for backup dirs: `.ccsk.bak-20260630-171530`. */
function backupStamp(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

/**
 * Removes the kit from `targetAbs`.
 *
 * Default (safe): removes SCAFFOLD only and PRESERVES USER MEMORY.
 * With `purgeMemory`: first MOVES the whole `.ccsk/` (memory + templates) into a
 * timestamped `.ccsk.bak-<ts>/` sibling, then removes the remaining scaffold.
 * USER MEMORY is never deleted outright — only relocated.
 */
export async function removeKit(targetAbs: string, opts: RemoveOptions = {}): Promise<RemoveResult> {
  const removed: string[] = [];

  if (opts.purgeMemory) {
    // Back up the entire .ccsk/ (memory + templates) before anything destructive.
    let backupDir: string | undefined;
    const ccskDir = path.join(targetAbs, '.ccsk');
    if (await pathExists(ccskDir)) {
      const backupName = `.ccsk.bak-${backupStamp()}`;
      backupDir = path.join(targetAbs, backupName);
      await fs.rename(ccskDir, backupDir);
      removed.push('.ccsk');
    }

    // Remove the non-.ccsk scaffold (templates went with the .ccsk move above).
    for (const name of SCAFFOLD_PATHS) {
      if (name.startsWith('.ccsk')) continue; // already relocated via the move
      const abs = path.join(targetAbs, name);
      if (await pathExists(abs)) {
        await fs.rm(abs, { recursive: true, force: true });
        removed.push(name);
      }
    }

    return { removed, preserved: [], backupDir };
  }

  // Default: remove scaffold (incl. .ccsk/templates), preserve user memory.
  for (const name of SCAFFOLD_PATHS) {
    const abs = path.join(targetAbs, name);
    if (await pathExists(abs)) {
      await fs.rm(abs, { recursive: true, force: true });
      removed.push(name);
    }
  }

  const preserved = await existingUserMemoryPaths(targetAbs);
  return { removed, preserved };
}
