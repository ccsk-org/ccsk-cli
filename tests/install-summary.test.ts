/**
 * Unit tests for the post-install summary: correct grouped counts from a
 * fixture kit srcDir + copy file list, and a box whose every line is the same
 * display width (emoji budgeted as 2 columns — the alignment invariant).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectGroups, renderSummary } from '../src/util/install-summary.js';

let srcDir: string;

function write(root: string, rel: string, body = 'x'): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

beforeEach(async () => {
  srcDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-sum-'));
  // 2 agents
  write(srcDir, 'plugins/ccsk/agents/planner.md');
  write(srcDir, 'plugins/ccsk/agents/executor.md');
  // 3 skills — one glue (not user-invocable)
  write(srcDir, 'plugins/ccsk/skills/plan/SKILL.md', '---\nname: plan\n---\n');
  write(srcDir, 'plugins/ccsk/skills/build/SKILL.md', '---\nname: build\n---\n');
  write(
    srcDir,
    'plugins/ccsk/skills/project-organization/SKILL.md',
    '---\nname: project-organization\nuser-invocable: false\n---\n',
  );
});
afterEach(async () => {
  await fsp.rm(srcDir, { recursive: true, force: true });
});

const files = [
  path.join('.claude', 'rules', 'common-rules.md'),
  path.join('.claude', 'rules', 'primary-workflows.md'),
  'CLAUDE.md',
  path.join('docs', 'x.md'),
];

/** Display width: strip ANSI, then count `✅` (1 JS char) as 2 columns. */
function displayWidth(s: string): number {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, '');
  const wideEmoji = (plain.match(/✅/g) ?? []).length;
  return [...plain].length + wideEmoji;
}

describe('collectGroups', () => {
  it('counts agents, skills, invocable commands, and rules', () => {
    const groups = collectGroups({ srcDir, files });
    const by = Object.fromEntries(groups.map((g) => [g.label, g]));

    expect(by.Agents.count).toBe(2);
    expect(by.Skills.count).toBe(3);
    expect(by.Commands.count).toBe(2); // glue skill excluded
    expect(by.Rules.count).toBe(2);
    expect(by.Commands.samples).toEqual(['/ccsk:build', '/ccsk:plan']);
    expect(by.Agents.samples).toEqual(['executor', 'planner']);
  });

  it('yields zero counts for a srcDir with no plugin dir', () => {
    const groups = collectGroups({ srcDir: os.tmpdir() + '/does-not-exist', files: [] });
    expect(groups.every((g) => g.count === 0)).toBe(true);
  });
});

describe('renderSummary', () => {
  it('emits lines of identical display width (emoji = 2 cols)', () => {
    const lines = renderSummary(collectGroups({ srcDir, files }));
    const widths = lines.map((l) => displayWidth(l.replace(/^ {2}/, ''))); // drop the 2-space indent
    expect(new Set(widths).size).toBe(1); // all equal
    expect(widths[0]).toBe(58); // WIDTH(56) + 2 border columns
  });

  it('renders the title, all group labels, and the guide CTA', () => {
    const text = renderSummary(collectGroups({ srcDir, files })).join('\n');
    expect(text).toContain('ccsk installed');
    for (const label of ['Agents', 'Skills', 'Commands', 'Rules']) expect(text).toContain(label);
    expect(text).toContain('/ccsk:guide');
  });
});
