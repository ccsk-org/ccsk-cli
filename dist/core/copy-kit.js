import fs from 'node:fs/promises';
import path from 'node:path';
import { makeProgress } from '../util/progress.js';
/** Root-level directories in a kit that are never copied into a target. */
const EXCLUDED_ROOT_DIRS = new Set(['todo']);
/**
 * Filenames that must never propagate from a kit into a user project,
 * regardless of where they sit in the tree. `settings.local.json` is
 * Claude Code's per-machine, user-generated state — shipping one breaks
 * `claude` launch on any schema mismatch. `.DS_Store` is a macOS artifact.
 */
const EXCLUDED_FILES = new Set(['settings.local.json', '.DS_Store']);
/** Maps a `_dot_X` path segment to `.X`; leaves other segments untouched. */
function renameSegment(segment) {
    const match = /^_dot_(.+)$/.exec(segment);
    return match ? `.${match[1]}` : segment;
}
/** Recursively collects relative file paths under `srcDir`, excluding root dirs. */
async function collectFiles(srcDir, rel = '') {
    const entries = await fs.readdir(path.join(srcDir, rel), { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const childRel = rel ? path.join(rel, entry.name) : entry.name;
        if (entry.isDirectory()) {
            if (rel === '' && EXCLUDED_ROOT_DIRS.has(entry.name))
                continue;
            files.push(...(await collectFiles(srcDir, childRel)));
        }
        else if (entry.isFile()) {
            if (EXCLUDED_FILES.has(entry.name))
                continue;
            files.push(childRel);
        }
    }
    return files;
}
/** Translates a source-relative path into its destination-relative form (`_dot_X` → `.X`). */
function toDestRel(rel) {
    return rel.split(path.sep).map(renameSegment).join(path.sep);
}
/**
 * Copies a kit's template directory into `targetAbs` verbatim, renaming `_dot_X`
 * segments to `.X` and skipping excluded root dirs (e.g. `todo/`). Overwrites
 * shipped files; never deletes unrelated user files. Reports percentage progress.
 * Returns the list of top-level destination entry names that were written.
 */
export async function copyKit(srcDir, targetAbs) {
    const files = await collectFiles(srcDir);
    const progress = makeProgress(files.length, 'Copying kit');
    const topLevel = new Set();
    let done = 0;
    progress(done);
    for (const rel of files) {
        const destRel = toDestRel(rel);
        const destPath = path.join(targetAbs, destRel);
        try {
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.copyFile(path.join(srcDir, rel), destPath);
        }
        catch (err) {
            throw new Error(`Failed to copy ${rel}: ${err.message}`);
        }
        topLevel.add(destRel.split(path.sep)[0]);
        progress(++done);
    }
    return [...topLevel].sort();
}
//# sourceMappingURL=copy-kit.js.map