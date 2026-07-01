/**
 * Post-install "what got installed" summary — a rounded box grouping the kit's
 * agents / skills / commands / rules with counts and a few sample names.
 *
 * Two data sources: the plugin roster (agents + skills) lives in the fetched
 * kit `srcDir` under `plugins/ccsk/` (it ships via the marketplace, NOT copyKit),
 * while rules come from the copyKit file list. Rendering matches the CLI's
 * picocolors conventions and the in-session banner family (rounded corners).
 */

import fs from 'node:fs';
import path from 'node:path';
import { pc } from './log.js';

/** Inner width between the vertical borders (visible columns). */
const WIDTH = 56;
/** Column budget for the sample-name list on each data row. */
const SAMPLE_WIDTH = WIDTH - 3 - 9 - 3 - 3; // indent + label + count + gap

export interface InstallSummaryInput {
  /** Fetched kit source dir (cache path) — where `plugins/ccsk/` lives. */
  srcDir: string;
  /** Destination-relative paths written by copyKit (OS-native separators). */
  files: string[];
}

interface Group {
  label: string;
  count: number;
  /** Sample names, or a fixed note shown instead of samples. */
  samples: string[];
  note?: string;
}

/** Collects the grouped roster from the fetched kit + copy file list. */
export function collectGroups(input: InstallSummaryInput): Group[] {
  const agents = listMarkdownNames(path.join(input.srcDir, 'plugins', 'ccsk', 'agents'));
  const skills = listSkills(path.join(input.srcDir, 'plugins', 'ccsk', 'skills'));
  const commands = skills.filter((s) => s.invocable).map((s) => s.name);
  const ruleCount = input.files.filter(isRulePath).length;

  return [
    { label: 'Agents', count: agents.length, samples: agents.slice(0, 3) },
    { label: 'Skills', count: skills.length, samples: skills.slice(0, 4).map((s) => s.name) },
    { label: 'Commands', count: commands.length, samples: commands.slice(0, 4).map((c) => `/ccsk:${c}`) },
    { label: 'Rules', count: ruleCount, samples: [], note: 'always-on contract (auto-loaded)' },
  ];
}

/** Prints the boxed install summary to stdout. */
export function printInstallSummary(input: InstallSummaryInput): void {
  for (const line of renderSummary(collectGroups(input))) console.log(line);
}

/** Builds the box as an array of ready-to-print (possibly colored) lines. */
export function renderSummary(groups: Group[]): string[] {
  const lines: string[] = [];
  lines.push(topBorder('ccsk installed'));
  lines.push(boxed(''.padEnd(WIDTH)));
  for (const g of groups) lines.push(boxed(dataRow(g)));
  lines.push(boxed(''.padEnd(WIDTH)));
  lines.push(boxed(footerRow()));
  lines.push('  ' + pc.dim('╰' + '─'.repeat(WIDTH) + '╯'));
  return lines;
}

/** Wraps a WIDTH-wide content string in dim vertical borders, indented by 2. */
function boxed(content: string): string {
  return '  ' + pc.dim('│') + content + pc.dim('│');
}

/** Top border with an embedded green title: `╭─ ✅ ccsk installed ───╮`. */
function topBorder(title: string): string {
  // Visible budget between corners: '─ '(2) + emoji(2) + ' '(1) + title + ' '(1) + fill = WIDTH.
  const fill = Math.max(0, WIDTH - (2 + 2 + 1 + title.length + 1));
  return (
    '  ' +
    pc.dim('╭─ ') +
    '✅ ' +
    pc.bold(pc.green(title)) +
    ' ' +
    pc.dim('─'.repeat(fill) + '╮')
  );
}

/** One `Label  NN  sample · sample` row, exactly WIDTH visible columns. */
function dataRow(g: Group): string {
  const label = g.label.padEnd(9);
  const count = String(g.count).padStart(3);
  const rest = g.note ?? g.samples.join(' · ');
  const samples = truncate(rest, SAMPLE_WIDTH).padEnd(SAMPLE_WIDTH);
  return '   ' + pc.bold(pc.cyan(label)) + pc.bold(pc.white(count)) + '   ' + pc.dim(samples);
}

/** The single call-to-action row: `→  /ccsk:guide   to see the cadence`. */
function footerRow(): string {
  const tail = '   to see the cadence'.padEnd(WIDTH - 3 - 1 - 2 - 11);
  return '   ' + pc.green('→') + '  ' + pc.bold(pc.cyan('/ccsk:guide')) + pc.dim(tail);
}

/** True for a materialized `.claude/rules/*.md` path (any OS separator). */
function isRulePath(rel: string): boolean {
  const parts = rel.split(path.sep);
  return parts[0] === '.claude' && parts[1] === 'rules' && rel.endsWith('.md');
}

/** Lists `*.md` basenames (without extension) in a dir, sorted; [] if absent. */
function listMarkdownNames(dir: string): string[] {
  return readDirSafe(dir)
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name.replace(/\.md$/, ''))
    .sort();
}

interface SkillEntry {
  name: string;
  invocable: boolean;
}

/** Lists skill dirs (each holding a SKILL.md), flagging user-invocable ones. */
function listSkills(dir: string): SkillEntry[] {
  return readDirSafe(dir)
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(dir, name, 'SKILL.md')))
    .sort()
    .map((name) => ({ name, invocable: isInvocable(path.join(dir, name, 'SKILL.md')) }));
}

/** A skill is invocable unless its frontmatter sets `user-invocable: false`. */
function isInvocable(skillMd: string): boolean {
  try {
    const head = fs.readFileSync(skillMd, 'utf8').slice(0, 2000);
    return !/^user-invocable:\s*false\b/m.test(head);
  } catch {
    return true;
  }
}

/** `readdirSync` with dirents, returning [] instead of throwing on a missing dir. */
function readDirSafe(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Truncates to `w` display columns, using `…` (1 col) as the ellipsis. */
function truncate(s: string, w: number): string {
  if (s.length <= w) return s;
  if (w <= 1) return '…';
  return s.slice(0, w - 1) + '…';
}
