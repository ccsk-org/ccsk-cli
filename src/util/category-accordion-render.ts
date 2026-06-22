/**
 * Presentational layer for the accordion design picker. Pure string formatting —
 * no prompt state, no IO — so the visual rows stay small and reviewable apart
 * from the `@clack/core` state machine in `category-accordion-prompt.ts`.
 */

import {
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
} from '@clack/prompts';
import pc from 'picocolors';
import type { DesignEntry } from '../core/design-catalog.js';

export type Row =
  | { kind: 'skip' }
  | { kind: 'sep' }
  | { kind: 'cat'; name: string; count: number }
  | { kind: 'design'; entry: DesignEntry; cat: string };

export const SKIP_LABEL = "✗ Skip — don't add a design";
export const TITLE = 'Pick a design reference';
export const HINT = '↑↓ navigate · space expand/collapse · ⏎ select · esc cancel';
export const MAX_VIEWPORT = 14;

export const cols = (): number => process.stdout.columns ?? 80;

export const fit = (s: string, width: number): string =>
  s.length <= width ? s : `${s.slice(0, Math.max(0, width - 1))}…`;

/** Renders a single visible row. `expanded` drives the category caret (▾/▸). */
export function renderRow(row: Row, active: boolean, expanded: Set<string>): string {
  const width = cols() - 3; // account for "│  " gutter

  if (row.kind === 'skip') {
    return active ? pc.cyan(SKIP_LABEL) : SKIP_LABEL;
  }

  if (row.kind === 'sep') {
    return pc.dim('─'.repeat(Math.min(Math.max(width, 8), 40)));
  }

  if (row.kind === 'cat') {
    const caret = expanded.has(row.name) ? '▾' : '▸';
    const label = `${caret} ${row.name}`;
    const count = String(row.count);
    const dots = '.'.repeat(Math.max(2, width - label.length - count.length - 2));
    const head = active ? pc.cyan(label) : label;
    return `${head} ${pc.dim(dots)} ${pc.dim(count)}`;
  }

  const marker = active ? pc.green(S_RADIO_ACTIVE) : pc.dim(S_RADIO_INACTIVE);
  const name = row.entry.name;
  const descWidth = width - 4 - name.length - 2; // indent + marker + gaps
  const desc = pc.dim(fit(row.entry.desc, Math.max(8, descWidth)));
  const shownName = active ? pc.cyan(name) : name;
  return `  ${marker} ${shownName}  ${desc}`;
}
