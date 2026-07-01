/**
 * Runs optional tool setup (RTK-AI + context-mode) after kit installation.
 */

import { makeProgress } from '../util/progress.js';
import { log, pc } from '../util/log.js';
import { ensureGhCli } from './gh-cli.js';
import { ensureRtk, rtkInit, wireRtkInstructions } from './rtk.js';
import { addContextModeMcp, printContextModeInstructions } from './context-mode.js';
import { addSerenaMcp } from './serena.js';
import type { StepResult } from './step-result.js';

/**
 * Runs the tool setup with percentage progress.
 * Steps never abort — failures are captured and reported.
 */
export async function runSetup(targetAbs: string): Promise<StepResult[]> {
  const steps: Array<() => Promise<StepResult> | StepResult> = [
    () => ensureGhCli(),
    () => ensureRtk(),
    () => rtkInit(targetAbs), // enable the RTK Claude Code hook in this project
    () => wireRtkInstructions(targetAbs), // RTK guidance → dedicated rule + CLAUDE.md import
    () => addContextModeMcp(),
    () => addSerenaMcp(),
    () => printContextModeInstructions(),
  ];

  const progress = makeProgress(steps.length, 'Setup');
  const results: StepResult[] = [];

  log.step('Running tool setup');
  let done = 0;
  progress(done);
  for (const step of steps) {
    results.push(await step());
    progress(++done);
  }

  printSummary(results);
  return results;
}

function printSummary(results: StepResult[]): void {
  const icon = { ok: pc.green('✓'), skipped: pc.yellow('–'), failed: pc.red('✗') };
  log.step('Setup summary');
  for (const r of results) {
    const detail = r.detail ? pc.dim(` (${r.detail})`) : '';
    console.log(`  ${icon[r.status]} ${r.name}${detail}`);
  }
}
