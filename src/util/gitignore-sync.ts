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

/**
 * Default policy: keep ALL AI-agentic artifacts out of git. These files still
 * exist in the working tree (gitignore never deletes them) — they are simply
 * not committed, so nothing AI-generated lands in the repo unless the user
 * deliberately opts in via the commented `!`-lines below.
 */
const BLOCK_BODY = [
  '# AI-agentic artifacts — ignored by default (kept locally, never committed).',
  '# Generated/memory state:',
  '.ccsk/',
  '.serena/',
  '.rtk/',
  '.add/',
  '.specify/',
  '.bmad/',
  '.agents/',
  '.planning/',
  '_bmad-output/',
  'loop-log.tsv',
  '**/loop-log.tsv',
  '',
  '# The kit contract, rules, docs & durable memory (ignored by default):',
  'CLAUDE.md',
  'AGENTS.md',
  '.claude/',
  'docs/',
  '',
  '# ── To SHARE the kit with your team, un-ignore what you want committed.',
  '#    Uncomment the lines below (a re-included dir also needs its parent',
  '#    un-ignored — e.g. keep `!.claude/` before `!.claude/rules/`).',
  '# !CLAUDE.md',
  '# !.claude/',
  '# !.claude/rules/',
  '# !docs/',
  '# !.ccsk/',
  '# !.ccsk/MEMORY.md',
  '# !.ccsk/adrs/',
  '# !.ccsk/plans/',
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
