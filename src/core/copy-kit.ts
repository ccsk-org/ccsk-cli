import fs from 'node:fs/promises';
import path from 'node:path';
import { makeProgress } from '../util/progress.js';

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
 * Copies a kit's template directory into `targetAbs` verbatim, renaming `_dot_X`
 * segments to `.X` and skipping excluded root dirs (e.g. `todo/`, `plugins/`).
 * Overwrites shipped files; never deletes unrelated user files. Reports
 * percentage progress. Returns the list of top-level destination entry names
 * that were written.
 *
 * Idempotent for USER MEMORY: existing `.ccsk/` memory (anything outside
 * `.ccsk/templates/`) is preserved on re-init/update — a present destination
 * file is left untouched rather than clobbered. See {@link isUserMemoryPath}.
 */
export async function copyKit(srcDir: string, targetAbs: string): Promise<string[]> {
  const files = await collectFiles(srcDir);
  const progress = makeProgress(files.length, 'Copying kit');
  const topLevel = new Set<string>();

  let done = 0;
  progress(done);
  for (const rel of files) {
    const destRel = toDestRel(rel);
    const destPath = path.join(targetAbs, destRel);

    // Preserve user memory: never overwrite an existing `.ccsk/` memory file.
    if (isUserMemoryPath(destRel) && (await pathExists(destPath))) {
      topLevel.add(destRel.split(path.sep)[0]);
      progress(++done);
      continue;
    }

    try {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(path.join(srcDir, rel), destPath);
    } catch (err) {
      throw new Error(`Failed to copy ${rel}: ${(err as Error).message}`);
    }
    topLevel.add(destRel.split(path.sep)[0]);
    progress(++done);
  }

  return [...topLevel].sort();
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
