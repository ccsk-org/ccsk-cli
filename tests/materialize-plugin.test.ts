/**
 * Unit tests for materializePlugin + normalizeMaterializedContract: agents/skills
 * are copied into the project (skills prefixed `ccsk-`), every `ccsk:` reference
 * is rewritten, skill `references/` are preserved, and re-runs are idempotent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  materializePlugin,
  normalizeMaterializedContract,
} from '../src/core/materialize-plugin.js';

let srcDir: string;
let targetDir: string;

function write(root: string, rel: string, body: string): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}
const read = (root: string, rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root: string, rel: string) => fs.existsSync(path.join(root, rel));

beforeEach(async () => {
  srcDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-mat-src-'));
  targetDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-mat-dst-'));

  // Agents (bare names) that reference each other via the plugin namespace.
  write(srcDir, 'plugins/ccsk/agents/planner.md', 'You are the planner. Hand off to `ccsk:executor`.');
  write(srcDir, 'plugins/ccsk/agents/executor.md', 'Spawn a separate `ccsk:code-reviewer` at Sign-off.');
  write(srcDir, 'plugins/ccsk/agents/code-reviewer.md', 'You review. Route back to /ccsk:build.');

  // Skills (namespaced commands) + a reference file.
  write(srcDir, 'plugins/ccsk/skills/plan/SKILL.md', '# /ccsk:plan\nThen run /ccsk:build.');
  write(srcDir, 'plugins/ccsk/skills/build/SKILL.md', '# /ccsk:build\nSpawn `ccsk:code-reviewer`.');
  write(srcDir, 'plugins/ccsk/skills/build/references/notes.md', 'See /ccsk:plan and ccsk:executor.');

  // Contract files materialized by copyKit (already in the project).
  write(targetDir, 'CLAUDE.md', 'Entry points: /ccsk:plan, /ccsk:build. Spawn ccsk:planner.');
  write(targetDir, '.claude/rules/orchestration-protocols.md', 'Invoke `ccsk:code-reviewer` for review.');
});
afterEach(async () => {
  await fsp.rm(srcDir, { recursive: true, force: true });
  await fsp.rm(targetDir, { recursive: true, force: true });
});

describe('materializePlugin', () => {
  it('copies agents (bare) and skills (ccsk- prefixed), rewriting the namespace', async () => {
    const res = await materializePlugin(srcDir, targetDir);

    expect(res.agents).toBe(3);
    expect(res.skills).toBe(2);

    // Agents: bare filenames, references rewritten to bare agent names.
    expect(exists(targetDir, '.claude/agents/planner.md')).toBe(true);
    expect(read(targetDir, '.claude/agents/planner.md')).toContain('Hand off to `executor`.');
    expect(read(targetDir, '.claude/agents/executor.md')).toContain('separate `code-reviewer`');
    expect(read(targetDir, '.claude/agents/code-reviewer.md')).toContain('/ccsk-build');

    // Skills: prefixed dirs, slash-commands rewritten, references/ preserved.
    expect(exists(targetDir, '.claude/skills/ccsk-plan/SKILL.md')).toBe(true);
    expect(exists(targetDir, '.claude/skills/ccsk-build/SKILL.md')).toBe(true);
    expect(read(targetDir, '.claude/skills/ccsk-plan/SKILL.md')).toBe('# /ccsk-plan\nThen run /ccsk-build.');
    expect(read(targetDir, '.claude/skills/ccsk-build/references/notes.md')).toBe(
      'See /ccsk-plan and executor.',
    );

    // No colon-namespaced tokens survive anywhere under the materialized skills.
    const buildSkill = read(targetDir, '.claude/skills/ccsk-build/SKILL.md');
    expect(buildSkill).not.toMatch(/ccsk:/);
  });

  it('preserves a user-authored agent while overwriting ccsk-owned ones', async () => {
    write(targetDir, '.claude/agents/my-custom.md', 'my own agent');
    write(targetDir, '.claude/skills/my-skill/SKILL.md', 'my own skill');

    await materializePlugin(srcDir, targetDir);

    expect(read(targetDir, '.claude/agents/my-custom.md')).toBe('my own agent');
    expect(read(targetDir, '.claude/skills/my-skill/SKILL.md')).toBe('my own skill');
    expect(exists(targetDir, '.claude/agents/planner.md')).toBe(true);
  });

  it('is idempotent — a second run reproduces identical output', async () => {
    await materializePlugin(srcDir, targetDir);
    const first = read(targetDir, '.claude/skills/ccsk-build/SKILL.md');
    const res2 = await materializePlugin(srcDir, targetDir);
    expect(res2.skills).toBe(2);
    expect(read(targetDir, '.claude/skills/ccsk-build/SKILL.md')).toBe(first);
  });
});

describe('normalizeMaterializedContract', () => {
  it('rewrites CLAUDE.md and rules in place, returning changed paths', async () => {
    const changed = await normalizeMaterializedContract(targetDir, srcDir);

    expect(read(targetDir, 'CLAUDE.md')).toBe(
      'Entry points: /ccsk-plan, /ccsk-build. Spawn planner.',
    );
    expect(read(targetDir, '.claude/rules/orchestration-protocols.md')).toBe(
      'Invoke `code-reviewer` for review.',
    );
    expect(changed).toContain('CLAUDE.md');
    expect(changed).toContain(path.join('.claude', 'rules', 'orchestration-protocols.md'));
  });

  it('leaves already-normalized files untouched (idempotent)', async () => {
    await normalizeMaterializedContract(targetDir, srcDir);
    const second = await normalizeMaterializedContract(targetDir, srcDir);
    expect(second).toEqual([]);
  });
});
