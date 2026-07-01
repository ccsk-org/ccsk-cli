import fs from 'node:fs/promises';
import path from 'node:path';
import { makeProgress } from '../util/progress.js';

/** How {@link copyKit} treats a destination file that already exists (and is not user memory). */
export type ConflictPolicy = 'backup' | 'keep';

/** Outcome of a {@link copyKit} run. */
export interface CopyKitResult {
  /** Top-level destination entry names that were written (sorted). */
  topLevel: string[];
  /** Every destination-relative path the kit ships (sorted); drives the install summary. */
  files: string[];
  /** Destination-relative paths whose prior contents were moved to a `*.bak` sibling. */
  backedUp: string[];
  /** Destination-relative paths left untouched; the kit's version was written as `*.ccsk.bak`. */
  kept: string[];
}

/**
 * Root-level directories in a kit that are never copied into a target.
 * `todo/` is maintainer scratch; `.github/` is repo CI + README assets
 * (workflows, diagram SVGs) that are meaningless inside a user project.
 *
 * `plugins/` and `.claude-plugin/` are the Claude Code PLUGIN source. The kit
 * is now distributed as a plugin (installed via `claude plugin install`, see
 * plugin-install.ts) PLUS materialized templates. The plugin source must never
 * be copied into the user project — it lives in the marketplace, not the repo.
 */
const EXCLUDED_ROOT_DIRS = new Set(['todo', '.github', 'plugins', '.claude-plugin']);

/**
 * Root-level files that document the kit itself rather than configure a
 * user project. The kit's `README.md` is its showcase landing page (it
 * would otherwise overwrite the user's own README); `VERSION` tracks the
 * kit's release, not the user's. `CLAUDE.md` is intentionally NOT here —
 * it is the harness config and must ship.
 */
const EXCLUDED_ROOT_FILES = new Set(['README.md', 'VERSION']);

/**
 * Filenames that must never propagate from a kit into a user project,
 * regardless of where they sit in the tree. `settings.local.json` is
 * Claude Code's per-machine, user-generated state — shipping one breaks
 * `claude` launch on any schema mismatch. `.DS_Store` is a macOS artifact.
 */
const EXCLUDED_FILES = new Set(['settings.local.json', '.DS_Store']);

/** Maps a `_dot_X` path segment to `.X`; leaves other segments untouched. */
function renameSegment(segment: string): string {
  const match = /^_dot_(.+)$/.exec(segment);
  return match ? `.${match[1]}` : segment;
}

/** Recursively collects relative file paths under `srcDir`, excluding root dirs. */
async function collectFiles(srcDir: string, rel = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(srcDir, rel), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const childRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (rel === '' && EXCLUDED_ROOT_DIRS.has(entry.name)) continue;
      files.push(...(await collectFiles(srcDir, childRel)));
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      if (rel === '' && EXCLUDED_ROOT_FILES.has(entry.name)) continue;
      files.push(childRel);
    }
  }
  return files;
}

/** Translates a source-relative path into its destination-relative form (`_dot_X` → `.X`). */
function toDestRel(rel: string): string {
  return rel.split(path.sep).map(renameSegment).join(path.sep);
}

/**
 * USER MEMORY: everything materialized under `.ccsk/` EXCEPT `.ccsk/templates/`.
 * This is the user's durable, self-authored state — plans, journals, retros,
 * adrs, milestones, and the `MEMORY.md` seed. On re-init/update we must NEVER
 * overwrite it (skip-if-exists). `.ccsk/templates/` is shipped scaffold and is
 * always refreshed so template fixes propagate.
 *
 * `destRel` is the destination-relative path (already `_dot_X` → `.X` renamed),
 * with OS-native separators.
 */
function isUserMemoryPath(destRel: string): boolean {
  const parts = destRel.split(path.sep);
  if (parts[0] !== '.ccsk') return false;
  if (parts[1] === 'templates') return false; // templates are refreshable scaffold
  return true; // MEMORY.md + plans/journals/retros/adrs/milestones/**
}

/**
 * Copies a kit's template directory into `targetAbs`, renaming `_dot_X` segments
 * to `.X` and skipping excluded root dirs (e.g. `todo/`, `plugins/`). Reports
 * percentage progress and returns a {@link CopyKitResult}.
 *
 * NON-DESTRUCTIVE conflict handling — when a shipped file already exists at the
 * destination, the user's data is never silently destroyed. The `onConflict`
 * policy (default `'backup'`) decides:
 *  - `'backup'`: move the existing file to `<name>.<ext>.bak`, then write ours.
 *  - `'keep'`:   leave the existing file; write ours alongside as `<name>.<ext>.ccsk.bak`.
 * On a `.bak`/`.ccsk.bak` name collision (e.g. a prior re-init), a timestamp is
 * appended so an earlier backup is never clobbered.
 *
 * Idempotent for USER MEMORY: existing `.ccsk/` memory (anything outside
 * `.ccsk/templates/`) is always preserved and never backed up — a present
 * destination file is left untouched. See {@link isUserMemoryPath}.
 */
export async function copyKit(
  srcDir: string,
  targetAbs: string,
  opts: { onConflict?: ConflictPolicy } = {},
): Promise<CopyKitResult> {
  const onConflict = opts.onConflict ?? 'backup';
  const files = await collectFiles(srcDir);
  const progress = makeProgress(files.length, 'Copying kit');
  const topLevel = new Set<string>();
  const backedUp: string[] = [];
  const kept: string[] = [];

  let done = 0;
  progress(done);
  for (const rel of files) {
    const destRel = toDestRel(rel);
    const destPath = path.join(targetAbs, destRel);
    const srcPath = path.join(srcDir, rel);

    // Preserve user memory: never overwrite an existing `.ccsk/` memory file.
    if (isUserMemoryPath(destRel) && (await pathExists(destPath))) {
      topLevel.add(destRel.split(path.sep)[0]);
      progress(++done);
      continue;
    }

    try {
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // Conflict: a non-memory file already exists at the destination.
      if (await pathExists(destPath)) {
        if (onConflict === 'keep') {
          // Keep the user's file; drop ours beside it as `<name>.<ext>.ccsk.bak`.
          await fs.copyFile(srcPath, await backupPath(destPath, '.ccsk.bak'));
          kept.push(destRel);
          topLevel.add(destRel.split(path.sep)[0]);
          progress(++done);
          continue;
        }
        // 'backup': move the user's file to `<name>.<ext>.bak`, then install ours.
        await fs.rename(destPath, await backupPath(destPath, '.bak'));
        backedUp.push(destRel);
      }

      await fs.copyFile(srcPath, destPath);
    } catch (err) {
      throw new Error(`Failed to copy ${rel}: ${(err as Error).message}`);
    }
    topLevel.add(destRel.split(path.sep)[0]);
    progress(++done);
  }

  return {
    topLevel: [...topLevel].sort(),
    files: files.map(toDestRel).sort(),
    backedUp,
    kept,
  };
}

/**
 * Returns the destination-relative paths a {@link copyKit} run would write over —
 * i.e. shipped (non-user-memory) files that already exist in `targetAbs`. Drives
 * the init conflict prompt. User-memory paths are excluded (always preserved).
 */
export async function findConflicts(srcDir: string, targetAbs: string): Promise<string[]> {
  const files = await collectFiles(srcDir);
  const conflicts: string[] = [];
  for (const rel of files) {
    const destRel = toDestRel(rel);
    if (isUserMemoryPath(destRel)) continue; // auto-preserved — not a conflict
    if (await pathExists(path.join(targetAbs, destRel))) conflicts.push(destRel);
  }
  return conflicts;
}

/** Timestamp suffix for backup collisions: `20260630-171530`. */
function backupStamp(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

/**
 * Builds a backup path `<dest><suffix>` (e.g. `CLAUDE.md.bak`). If that already
 * exists (a prior backup), a timestamp is appended so it is never overwritten.
 */
async function backupPath(dest: string, suffix: string): Promise<string> {
  const base = `${dest}${suffix}`;
  if (!(await pathExists(base))) return base;
  let candidate = `${base}.${backupStamp()}`;
  let n = 2;
  while (await pathExists(candidate)) candidate = `${base}.${backupStamp()}-${n++}`;
  return candidate;
}

/** True if a path exists on disk (file or dir). */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
