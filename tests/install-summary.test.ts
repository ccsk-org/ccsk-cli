/**
 * Unit tests for the post-install summary: mode-accurate counts (plugin mode
 * reads the kit cache; materialize mode reads the project's `.claude/`), and a
 * box whose every line is the same display width (emoji budgeted as 2 columns).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  collectGroups,
  renderSummary,
  type InstallSummaryInput,
} from '../src/util/install-summary.js';

let srcDir: string;
let targetDir: string;

function write(root: string, rel: string, body = 'x'): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

beforeEach(async () => {
  srcDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-sum-src-'));
  targetDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-sum-dst-'));
  // Kit cache layout (plugin source): 2 agents, 3 skills (one glue).
  write(srcDir, 'plugins/ccsk/agents/planner.md');
  write(srcDir, 'plugins/ccsk/agents/executor.md');
  write(srcDir, 'plugins/ccsk/skills/plan/SKILL.md', '---\nname: plan\n---\n');
  write(srcDir, 'plugins/ccsk/skills/build/SKILL.md', '---\nname: build\n---\n');
  write(
    srcDir,
    'plugins/ccsk/skills/project-organization/SKILL.md',
    '---\nname: project-organization\nuser-invocable: false\n---\n',
  );
  // Materialized project layout: bare agents, ccsk-prefixed skill dirs.
  write(targetDir, '.claude/agents/planner.md');
  write(targetDir, '.claude/agents/executor.md');
  write(targetDir, '.claude/skills/ccsk-plan/SKILL.md', '---\nname: plan\n---\n');
  write(targetDir, '.claude/skills/ccsk-build/SKILL.md', '---\nname: build\n---\n');
  write(
    targetDir,
    '.claude/skills/ccsk-project-organization/SKILL.md',
    '---\nname: project-organization\nuser-invocable: false\n---\n',
  );
});
afterEach(async () => {
  await fsp.rm(srcDir, { recursive: true, force: true });
  await fsp.rm(targetDir, { recursive: true, force: true });
});

const files = [
  path.join('.claude', 'rules', 'common-rules.md'),
  path.join('.claude', 'rules', 'primary-workflows.md'),
  'CLAUDE.md',
  path.join('docs', 'x.md'),
];

const pluginInput = (): InstallSummaryInput => ({ mode: 'plugin', srcDir, targetAbs: targetDir, files });
const matInput = (): InstallSummaryInput => ({ mode: 'materialize', srcDir, targetAbs: targetDir, files });

/** Display width: strip ANSI, then count `✅` (1 JS char) as 2 columns. */
function displayWidth(s: string): number {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, '');
  const wideEmoji = (plain.match(/✅/g) ?? []).length;
  return [...plain].length + wideEmoji;
}

describe('collectGroups — plugin mode (reads kit cache)', () => {
  it('counts agents, skills, invocable commands, and rules', () => {
    const by = Object.fromEntries(collectGroups(pluginInput()).map((g) => [g.label, g]));
    expect(by.Agents.count).toBe(2);
    expect(by.Skills.count).toBe(3);
    expect(by.Commands.count).toBe(2); // glue skill excluded
    expect(by.Rules.count).toBe(2);
    expect(by.Commands.samples).toEqual(['/ccsk:build', '/ccsk:plan']);
    expect(by.Agents.samples).toEqual(['executor', 'planner']);
  });
});

describe('collectGroups — materialize mode (reads project .claude/)', () => {
  it('counts from the project and uses /ccsk-<name> commands', () => {
    const by = Object.fromEntries(collectGroups(matInput()).map((g) => [g.label, g]));
    expect(by.Agents.count).toBe(2);
    expect(by.Skills.count).toBe(3);
    expect(by.Commands.count).toBe(2);
    expect(by.Rules.count).toBe(2);
    expect(by.Commands.samples).toEqual(['/ccsk-build', '/ccsk-plan']);
    expect(by.Agents.samples).toEqual(['executor', 'planner']);
  });

  it('yields zero counts when the project has no materialized agents/skills', () => {
    const empty = collectGroups({ mode: 'materialize', srcDir, targetAbs: os.tmpdir() + '/nope', files: [] });
    expect(empty.filter((g) => g.label !== 'Rules').every((g) => g.count === 0)).toBe(true);
  });
});

describe('renderSummary', () => {
  it('emits lines of identical display width in both modes (emoji = 2 cols)', () => {
    for (const input of [pluginInput(), matInput()]) {
      const lines = renderSummary(collectGroups(input), input.mode);
      const widths = lines.map((l) => displayWidth(l.replace(/^ {2}/, '')));
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBe(58); // WIDTH(56) + 2 border columns
    }
  });

  it('renders the mode-appropriate guide CTA', () => {
    expect(renderSummary(collectGroups(matInput()), 'materialize').join('\n')).toContain('/ccsk-guide');
    expect(renderSummary(collectGroups(pluginInput()), 'plugin').join('\n')).toContain('/ccsk:guide');
  });
});
