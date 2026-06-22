/**
 * Accordion design picker.
 *
 * A single-screen category → design selector built on @clack/core's Prompt.
 * Categories start collapsed; pressing space (or → / Enter on a header) expands
 * a category inline into its design rows — each row shows the design name plus a
 * short description, mirroring the old flat design list. ← collapses. ↑↓ walk
 * every visible row. Enter on a design row selects it.
 *
 * Because expansion happens in place, there is no drill-down to get trapped in:
 * "going back" is just collapsing the category. Replaces the old two-step
 * (category select → design select) that had no back path and no preview.
 *
 *   ◆  Pick a design reference
 *   │  ↑↓ navigate · space expand/collapse · ⏎ select · esc cancel
 *   │  ▸ AI & LLM Platforms ···························· 13
 *   │  ▾ Developer Tools & IDEs ························· 11
 *   │      ● Vercel   Frontend deployment. Black & white…
 *   │      ○ Expo     React Native platform. Dark theme…
 *   │  ▸ Fintech & Crypto ······························  7
 *   └
 */

import { Prompt } from '@clack/core';
import {
  S_BAR,
  S_BAR_END,
  S_STEP_ACTIVE,
  S_STEP_SUBMIT,
  S_STEP_CANCEL,
} from '@clack/prompts';
import pc from 'picocolors';
import type { DesignEntry } from '../core/design-catalog.js';
import {
  HINT,
  MAX_VIEWPORT,
  TITLE,
  renderRow,
  type Row,
} from './category-accordion-render.js';

export interface CategoryGroup {
  name: string;
  designs: DesignEntry[];
}

class CategoryAccordionPrompt extends Prompt<string | undefined> {
  private readonly groups: CategoryGroup[];
  private readonly expanded = new Set<string>();
  private rows: Row[] = [];
  private cursor = 0;

  constructor(groups: CategoryGroup[]) {
    super({ render: () => '' } as never, false);
    // Base binds `render` from opts, but our frame needs `this`; rebind now.
    (this as unknown as { _render: () => string })._render = () => this.frame();

    this.groups = groups;
    this.rebuild();
    this.cursor = this.rows.findIndex((r) => r.kind === 'cat'); // start on first category
    this.sync();

    this.on('cursor', (key?: string) => {
      switch (key) {
        case 'up':
          this.move(-1);
          break;
        case 'down':
          this.move(1);
          break;
        case 'left':
          this.collapse();
          break;
        case 'right':
          this.expand();
          break;
        case 'space':
          this.toggle();
          break;
      }
      this.sync();
    });

    // Enter on a category header expands it instead of submitting; _shouldSubmit
    // below blocks submission unless a design row is focused.
    this.on('key', (_char: string | undefined, key: { name?: string }) => {
      if (key?.name === 'return') {
        if (this.focused?.kind === 'cat') this.toggle();
        else if (this.focused?.kind === 'skip') this.state = 'cancel'; // base closes as cancel
      }
      this.sync();
    });
  }

  /** Only a focused design row may submit; Enter on a header expands instead. */
  protected _shouldSubmit(): boolean {
    return this.focused?.kind === 'design';
  }

  private get focused(): Row | undefined {
    return this.rows[this.cursor];
  }

  private rebuild(): void {
    this.rows = [{ kind: 'skip' }, { kind: 'sep' }];
    for (const g of this.groups) {
      this.rows.push({ kind: 'cat', name: g.name, count: g.designs.length });
      if (this.expanded.has(g.name)) {
        for (const entry of g.designs) this.rows.push({ kind: 'design', entry, cat: g.name });
      }
    }
  }

  private move(delta: number): void {
    let next = this.cursor + delta;
    while (next >= 0 && next < this.rows.length && this.rows[next].kind === 'sep') next += delta;
    if (next >= 0 && next < this.rows.length) this.cursor = next;
  }

  /** Toggle the focused category (or the parent category of a focused design). */
  private toggle(): void {
    const name = this.parentCategory();
    if (!name) return;
    if (this.expanded.has(name)) this.expanded.delete(name);
    else this.expanded.add(name);
    this.rebuild();
    this.cursor = this.rows.findIndex((r) => r.kind === 'cat' && r.name === name);
  }

  private expand(): void {
    const r = this.focused;
    if (r?.kind === 'cat' && !this.expanded.has(r.name)) this.toggle();
  }

  private collapse(): void {
    const r = this.focused;
    if (r?.kind === 'cat' && this.expanded.has(r.name)) this.toggle();
    else if (r?.kind === 'design') this.toggle(); // collapse parent, cursor lands on header
  }

  private parentCategory(): string | undefined {
    const r = this.focused;
    if (r?.kind === 'cat') return r.name;
    if (r?.kind === 'design') return r.cat;
    return undefined;
  }

  private sync(): void {
    const r = this.focused;
    this.value = r?.kind === 'design' ? r.entry.slug : undefined;
  }

  private frame(): string {
    const bar = pc.cyan(S_BAR);

    if (this.state === 'submit') {
      const entry = this.findBySlug(this.value as string | undefined);
      const label = entry ? `${entry.name} — ${entry.desc}` : 'design selected';
      return `${pc.green(S_STEP_SUBMIT)}  ${TITLE}\n${pc.gray(S_BAR)}  ${pc.dim(label)}`;
    }
    if (this.state === 'cancel') {
      return `${pc.red(S_STEP_CANCEL)}  ${TITLE}\n${pc.gray(S_BAR)}  ${pc.dim('Cancelled')}`;
    }

    const lines = [`${pc.cyan(S_STEP_ACTIVE)}  ${TITLE}`, `${bar}  ${pc.dim(HINT)}`];

    const total = this.rows.length;
    const max = Math.min(MAX_VIEWPORT, total);
    const start =
      total > max
        ? Math.min(Math.max(this.cursor - Math.floor(max / 2), 0), total - max)
        : 0;

    if (start > 0) lines.push(`${bar}  ${pc.dim('↑ more')}`);
    for (let i = start; i < start + max; i++) {
      lines.push(`${bar}  ${renderRow(this.rows[i], i === this.cursor, this.expanded)}`);
    }
    if (start + max < total) lines.push(`${bar}  ${pc.dim('↓ more')}`);

    lines.push(pc.cyan(S_BAR_END));
    return lines.join('\n');
  }

  private findBySlug(slug: string | undefined): DesignEntry | undefined {
    if (!slug) return undefined;
    for (const g of this.groups) {
      const hit = g.designs.find((d) => d.slug === slug);
      if (hit) return hit;
    }
    return undefined;
  }
}

/**
 * Show the accordion picker. Resolves to the chosen design slug, or the
 * @clack/core cancel symbol when the user aborts (check with `isCancel`).
 */
export function pickDesignByCategory(groups: CategoryGroup[]): Promise<string | symbol> {
  return new CategoryAccordionPrompt(groups).prompt() as Promise<string | symbol>;
}
