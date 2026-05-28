/**
 * Syncs a marker-fenced `.gitignore` block into a target project.
 *
 * Idempotent: creates the file if missing, appends the block once if present
 * without the fence, or replaces the existing fenced region in place. Lines
 * outside the fence are never touched.
 */

import fs from 'node:fs';
import path from 'node:path';

const MARKER = '# ----- ccsk gitignore -----';

const BLOCK_BODY = [
  '.ccsk/',
  '.claude/',
  '.specify/',
  '.bmad/',
  '.agents/',
  '.rtk/',
  '.serena/',
  '.planning/',
  '',
  'plans/',
  'docs/',
  '_bmad-output/',
  '',
  'AGENTS.md',
  'CLAUDE.md',
].join('\n');

const BLOCK = `${MARKER}\n${BLOCK_BODY}\n${MARKER}`;

export function ensureCcskGitignoreBlock(targetAbs: string): 'created' | 'merged' | 'replaced' {
  const file = path.join(targetAbs, '.gitignore');

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${BLOCK}\n`, 'utf8');
    return 'created';
  }

  const existing = fs.readFileSync(file, 'utf8');
  const start = existing.indexOf(MARKER);

  if (start === -1) {
    const sep = existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(file, `${existing}${sep}${BLOCK}\n`, 'utf8');
    return 'merged';
  }

  // Find the closing marker on a line after the opening one.
  const end = existing.indexOf(MARKER, start + MARKER.length);
  if (end === -1) {
    // Opening marker exists but no closing one — append a fresh block and bail.
    fs.writeFileSync(file, `${existing}\n${BLOCK}\n`, 'utf8');
    return 'merged';
  }

  const after = end + MARKER.length;
  const before = existing.slice(0, start);
  const tail = existing.slice(after);
  fs.writeFileSync(file, `${before}${BLOCK}${tail}`, 'utf8');
  return 'replaced';
}
