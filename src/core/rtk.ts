import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { binExists, platform } from '../util/platform.js';
import { log } from '../util/log.js';
import { RTK_INSTRUCTIONS_MARKDOWN } from '../templates/rtk-instructions.js';
import type { StepResult } from './step-result.js';

// TODO(pin): ideally pin install.sh to a release tag + verify its checksum
// instead of tracking `master` HEAD. Not done here because:
//   1. upstream `install.sh` lives on branch refs (master/develop), not on the
//      per-release tags, so there is no stable tagged URL for the script;
//   2. the script ALREADY downloads the latest release binary and verifies its
//      checksum itself, so the binary is integrity-checked downstream;
//   3. rtk ships rapid rc tags (e.g. dev-0.43.0-rc.NNN), so a hardcoded
//      script-checksum here would go stale almost immediately.
// Revisit if upstream publishes a tagged, checksummed installer.
const INSTALL_URL = 'https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh';
const RELEASES_URL = 'https://github.com/rtk-ai/rtk/releases';

/**
 * Runs the rtk install.sh by fetching it and piping the text into `sh` via stdin.
 * The source URL is printed first so the user can see exactly what is executed
 * (this path pipes a remote script to a shell — see docs/security-audit-report.md).
 */
async function installViaCurlScript(): Promise<void> {
  log.step(`Installing rtk from ${INSTALL_URL}`);
  const res = await fetch(INSTALL_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
  const script = await res.text();
  await execa('sh', { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
}

/**
 * Ensures the `rtk` binary is installed. macOS/Linux: brew → curl install → cargo.
 * Windows: cargo if present, otherwise reports a manual-download hint.
 */
export async function ensureRtk(): Promise<StepResult> {
  const name = 'rtk install';
  if (await binExists('rtk')) return { name, status: 'skipped', detail: 'already installed' };

  try {
    if (!platform.isWindows && (await binExists('brew'))) {
      await execa('brew', ['install', 'rtk'], { stdio: 'inherit' });
      return { name, status: 'ok', detail: 'via brew' };
    }
    if (!platform.isWindows && (await binExists('curl'))) {
      await installViaCurlScript();
      return { name, status: 'ok', detail: 'via install.sh' };
    }
    if (await binExists('cargo')) {
      await execa('cargo', ['install', '--git', 'https://github.com/rtk-ai/rtk', 'rtk'], {
        stdio: 'inherit',
      });
      return { name, status: 'ok', detail: 'via cargo' };
    }
  } catch (err) {
    return { name, status: 'failed', detail: (err as Error).message };
  }

  const hint = platform.isWindows
    ? `no cargo found — download a release from ${RELEASES_URL}`
    : `no brew, curl, or cargo found — see ${RELEASES_URL}`;
  return { name, status: 'failed', detail: hint };
}

/**
 * Runs `rtk init` in the target project (enables the Claude Code hook).
 *
 * CLAUDE.md is the project contract and must stay clean, so we snapshot it
 * before `rtk init` and restore it afterward: `rtk init` mutates CLAUDE.md to
 * add its own usage block, but we re-introduce that guidance as a dedicated
 * rule file instead (see {@link wireRtkInstructions}). Everything else `rtk init`
 * writes — notably the `.claude/settings.json` hook that makes RTK work — is
 * left untouched.
 */
export async function rtkInit(targetAbs: string): Promise<StepResult> {
  const name = 'rtk init';
  if (!(await binExists('rtk'))) return { name, status: 'skipped', detail: 'rtk not on PATH' };

  const claudeMd = path.join(targetAbs, 'CLAUDE.md');
  const before = await readIfExists(claudeMd);

  const { exitCode, stderr } = await execa('rtk', ['init'], {
    cwd: targetAbs,
    reject: false,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  // Restore CLAUDE.md if `rtk init` changed it (it only existed before if the
  // kit shipped it, which it always does — so we never resurrect a deleted file).
  let preserved = false;
  if (before !== null) {
    const after = await readIfExists(claudeMd);
    if (after !== before) {
      await fs.writeFile(claudeMd, before, 'utf8');
      preserved = true;
    }
  }

  if (exitCode === 0) {
    return { name, status: 'ok', detail: preserved ? 'CLAUDE.md preserved' : undefined };
  }
  return { name, status: 'failed', detail: stderr?.trim() || `exit ${exitCode}` };
}

/**
 * Materializes RTK guidance as a dedicated rule file and references it from
 * CLAUDE.md with a single contract-style `@`-import — the ONE controlled write
 * to CLAUDE.md (matching how the always-on rules are imported). Runs only when
 * RTK is actually present, so non-RTK projects keep a clean CLAUDE.md.
 *
 * Idempotent: the rule file is refreshed each run, and the import line is
 * inserted only if not already present.
 */
export async function wireRtkInstructions(targetAbs: string): Promise<StepResult> {
  const name = 'rtk instructions';
  if (!(await binExists('rtk'))) return { name, status: 'skipped', detail: 'rtk not on PATH' };

  const ruleRel = '.claude/rules/rtk-instructions.md';
  const rulePath = path.join(targetAbs, ...ruleRel.split('/'));
  await fs.mkdir(path.dirname(rulePath), { recursive: true });
  await fs.writeFile(rulePath, RTK_INSTRUCTIONS_MARKDOWN, 'utf8');

  const claudeMd = path.join(targetAbs, 'CLAUDE.md');
  const source = await readIfExists(claudeMd);
  if (source === null) {
    return { name, status: 'ok', detail: `wrote ${ruleRel} (no CLAUDE.md to reference it)` };
  }

  const importLine = `@${ruleRel}`;
  if (source.includes(importLine)) {
    return { name, status: 'skipped', detail: 'already referenced' };
  }

  await fs.writeFile(claudeMd, insertRuleImport(source, importLine), 'utf8');
  return { name, status: 'ok', detail: `→ ${ruleRel}` };
}

/**
 * Inserts `importLine` immediately after the last existing `@.claude/rules/*.md`
 * import so RTK sits with the contract rules. Falls back to appending a small
 * section when CLAUDE.md has no rule-import block.
 */
function insertRuleImport(source: string, importLine: string): string {
  const lines = source.split('\n');
  const isRuleImport = (l: string): boolean => /^@\.claude\/rules\/.+\.md\s*$/.test(l);
  let lastIdx = -1;
  for (let i = 0; i < lines.length; i++) if (isRuleImport(lines[i])) lastIdx = i;

  if (lastIdx >= 0) {
    lines.splice(lastIdx + 1, 0, importLine);
    return lines.join('\n');
  }

  const suffix = source.endsWith('\n') ? '' : '\n';
  return `${source}${suffix}\n## RTK (optional tool — wired by ccsk init)\n\n${importLine}\n`;
}

/** Reads a file as UTF-8, returning `null` if it does not exist. */
async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}
