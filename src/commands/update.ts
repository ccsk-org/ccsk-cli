/**
 * ccsk update — keep the install coherent across three layers, each as a
 * non-aborting step so one failure never blocks the others:
 *   1. self-update the CLI binary (existing behaviour);
 *   2. re-materialize kit templates into the project (idempotent copy — user
 *      memory is preserved by copy-kit);
 *   3. update the ccsk Claude Code plugin, pinned to the same resolved kit
 *      version, so plugin + templates never drift.
 */

import path from 'node:path';
import { runSelfUpdate } from '../core/self-update.js';
import { detectAuthMethod } from '../core/github-auth.js';
import { fetchKit } from '../core/kit-fetcher.js';
import { copyKit } from '../core/copy-kit.js';
import { updateCcskPlugin, type PluginScope } from '../core/plugin-install.js';
import { log, pc } from '../util/log.js';
import type { StepResult } from '../core/step-result.js';

export interface UpdateOptions {
  /** CLI version to self-install (e.g. `latest`, `1.2.3`). */
  version: string;
  /** Project dir to re-materialize templates into. */
  targetPath?: string;
  /** Kit version to materialize (defaults to latest resolved by fetchKit). */
  kitVersion?: string;
  /** Re-materialize kit templates. Default true. */
  templates?: boolean;
  /** Update the ccsk Claude Code plugin. Default true. */
  plugin?: boolean;
  /** Plugin scope. Default `project`. */
  pluginScope?: PluginScope;
}

export async function runUpdate(opts: UpdateOptions): Promise<void> {
  const results: StepResult[] = [];

  // 1. Self-update the CLI binary (non-aborting).
  results.push(await runStep('cli self-update', async () => {
    await runSelfUpdate({ version: opts.version });
    return { detail: `requested ${opts.version}` };
  }));

  const wantTemplates = opts.templates !== false;
  const wantPlugin = opts.plugin !== false;

  if (wantTemplates || wantPlugin) {
    const targetAbs = path.resolve(process.cwd(), opts.targetPath ?? '.');

    // Fetch the kit once so templates + plugin pin to ONE resolved version.
    const auth = await detectAuthMethod();
    if (auth.method === 'none') {
      results.push({
        name: 'kit fetch',
        status: 'skipped',
        detail: 'GitHub auth required — run `ccsk auth`',
      });
    } else {
      const fetch = await fetchKit({ version: opts.kitVersion });
      if (!fetch.success) {
        results.push({ name: 'kit fetch', status: 'failed', detail: fetch.error });
      } else {
        results.push({ name: 'kit fetch', status: 'ok', detail: `v${fetch.version}` });

        // 2. Re-materialize templates (idempotent — preserves user memory).
        if (wantTemplates) {
          results.push(await runStep('templates', async () => {
            const written = await copyKit(fetch.cachePath, targetAbs);
            return { detail: written.join(', ') };
          }));
        }

        // 3. Update the plugin, pinned to the freshly-fetched cache path.
        if (wantPlugin) {
          results.push(
            await updateCcskPlugin({
              source: fetch.cachePath,
              scope: opts.pluginScope ?? 'project',
            }),
          );
        }
      }
    }
  }

  printSummary(results);
}

/** Runs a step, converting throws into a `failed` StepResult (never aborts). */
async function runStep(
  name: string,
  fn: () => Promise<{ detail?: string }>,
): Promise<StepResult> {
  try {
    const { detail } = await fn();
    return { name, status: 'ok', detail };
  } catch (err) {
    return { name, status: 'failed', detail: (err as Error).message };
  }
}

function printSummary(results: StepResult[]): void {
  const icon = { ok: pc.green('✓'), skipped: pc.yellow('–'), failed: pc.red('✗') };
  log.step('Update summary');
  for (const r of results) {
    const detail = r.detail ? pc.dim(` (${r.detail})`) : '';
    console.log(`  ${icon[r.status]} ${r.name}${detail}`);
  }
}
