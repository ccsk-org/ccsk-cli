/**
 * ccsk auth — display GitHub authentication status and guidance.
 */

import { runAuthCommand } from '../core/github-auth.js';

export async function runAuth(): Promise<void> {
  await runAuthCommand();
}
