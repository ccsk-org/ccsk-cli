/**
 * ccsk update — upgrade the globally installed CLI to a target version.
 */

import { runSelfUpdate } from '../core/self-update.js';

export async function runUpdate(opts: { version: string }): Promise<void> {
  await runSelfUpdate(opts);
}
