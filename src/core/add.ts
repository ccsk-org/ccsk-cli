/**
 * ADD (AI-Driven Development) installer.
 * Runs `npx @pilotspace/add init` in the target project.
 */

import { execa } from 'execa';
import type { StepResult } from './step-result.js';

/**
 * Installs ADD into the target project via npx.
 * Graceful: catches errors and returns failed status instead of throwing.
 */
export async function ensureAdd(targetAbs: string): Promise<StepResult> {
  const name = 'ADD install';

  try {
    const { exitCode, stderr } = await execa('npx', ['@pilotspace/add', 'init'], {
      cwd: targetAbs,
      reject: false,
      stdio: ['inherit', 'inherit', 'pipe'],
    });

    if (exitCode === 0) {
      return { name, status: 'ok', detail: 'via npx @pilotspace/add init' };
    }

    return { name, status: 'failed', detail: stderr?.trim() || `exit ${exitCode}` };
  } catch (err) {
    return { name, status: 'failed', detail: (err as Error).message };
  }
}
