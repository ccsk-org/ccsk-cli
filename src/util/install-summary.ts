/**
 * Post-install "what got installed" summary — a rounded box grouping the kit's
 * agents / skills / commands / rules with counts and a few sample names.
 *
 * Mode-aware so the counts reflect REALITY:
 *  - `materialize` (default): agents/skills are copied into the project, so we
 *    count them from `<target>/.claude/{agents,skills}` — what actually landed.
 *  - `plugin` (legacy `--plugin`): agents/skills live in the installed plugin,
 *    so we count them from the fetched kit cache (`srcDir/plugins/ccsk`).
 * Rules always come from the copyKit file list. Rendering matches the CLI's
 * picocolors conventions and the in-session banner family (rounded corners).
 */

import path from 'node:path';
import { pc } from './log.js';
import { listMarkdownNames, listSkills, type SkillEntry } from '../core/plugin-roster.js';

/** Inner width between the vertical borders (visible columns). */
const WIDTH = 56;
/** Column budget for the sample-name list on each data row. */
const SAMPLE_WIDTH = WIDTH - 3 - 9 - 3 - 3; // indent + label + count + gap

export type DeliveryMode = 'materialize' | 'plugin';

export interface InstallSummaryInput {
  /** How agents/skills were delivered — decides where counts come from. */
  mode: DeliveryMode;
  /** Fetched kit source dir (cache path) — where `plugins/ccsk/` lives. */
  srcDir: string;
  /** Target project dir — where materialized `.claude/{agents,skills}` live. */
  targetAbs: string;
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

/** The guide command differs by mode (materialized `/ccsk-guide` vs plugin `/ccsk:guide`). */
function guideCommand(mode: DeliveryMode): string {
  return mode === 'materialize' ? '/ccsk-guide' : '/ccsk:guide';
}

/** Collects the grouped roster, reading counts from the mode-appropriate source. */
export function collectGroups(input: InstallSummaryInput): Group[] {
  const agentDir =
    input.mode === 'materialize'
      ? path.join(input.targetAbs, '.claude', 'agents')
      : path.join(input.srcDir, 'plugins', 'ccsk', 'agents');
  const skillDir =
    input.mode === 'materialize'
      ? path.join(input.targetAbs, '.claude', 'skills')
      : path.join(input.srcDir, 'plugins', 'ccsk', 'skills');

  const agents = listMarkdownNames(agentDir);
  const skills = listSkills(skillDir);
  const commands = skills.filter((s) => s.invocable).map((s) => commandName(s, input.mode));
  const ruleCount = input.files.filter(isRulePath).length;

  return [
    { label: 'Agents', count: agents.length, samples: agents.slice(0, 3) },
    { label: 'Skills', count: skills.length, samples: skills.slice(0, 4).map((s) => s.name) },
    { label: 'Commands', count: commands.length, samples: commands.slice(0, 3) },
    { label: 'Rules', count: ruleCount, samples: [], note: 'always-on contract (auto-loaded)' },
  ];
}

/**
 * The slash-command a skill exposes. In materialize mode the skill dir is
 * already `ccsk-<name>`, so the command is `/<dir>`. In plugin mode the plugin
 * namespaces it as `/ccsk:<name>`.
 */
function commandName(s: SkillEntry, mode: DeliveryMode): string {
  return mode === 'materialize' ? `/${s.name}` : `/ccsk:${s.name}`;
}

/** Prints the boxed install summary to stdout. */
export function printInstallSummary(input: InstallSummaryInput): void {
  for (const line of renderSummary(collectGroups(input), input.mode)) console.log(line);
}

/** Builds the box as an array of ready-to-print (possibly colored) lines. */
export function renderSummary(groups: Group[], mode: DeliveryMode = 'materialize'): string[] {
  const lines: string[] = [];
  lines.push(topBorder('ccsk installed'));
  lines.push(boxed(''.padEnd(WIDTH)));
  for (const g of groups) lines.push(boxed(dataRow(g)));
  lines.push(boxed(''.padEnd(WIDTH)));
  lines.push(boxed(footerRow(mode)));
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

/** The single call-to-action row: `→  <guide>   to see the cadence`. */
function footerRow(mode: DeliveryMode): string {
  const guide = guideCommand(mode);
  const tail = '   to see the cadence'.padEnd(WIDTH - 3 - 1 - 2 - guide.length);
  return '   ' + pc.green('→') + '  ' + pc.bold(pc.cyan(guide)) + pc.dim(tail);
}

/** True for a materialized `.claude/rules/*.md` path (any OS separator). */
function isRulePath(rel: string): boolean {
  const parts = rel.split(path.sep);
  return parts[0] === '.claude' && parts[1] === 'rules' && rel.endsWith('.md');
}

/** Truncates to `w` display columns, using `…` (1 col) as the ellipsis. */
function truncate(s: string, w: number): string {
  if (s.length <= w) return s;
  if (w <= 1) return '…';
  return s.slice(0, w - 1) + '…';
}
