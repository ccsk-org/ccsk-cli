/**
 * ccsk donate — support the project with a coffee via VietQR.
 */

import { printBanner } from '../util/banner.js';
import { runDonateFlow } from '../core/donation.js';

export async function runDonate(): Promise<void> {
  printBanner({
    slogan: 'Support the Claude Code Starter Kit project',
    author: 'Crystal D.',
    contributors: 'E.Wallis',
    organization: 'Trustify Technology JSC · US',
    version: '',
  });

  await runDonateFlow();
}
