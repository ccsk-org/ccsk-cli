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
import {
  fetchKit,
  resolveLatestStable,
  resolveLatestPrerelease,
  compareKitVersion,
} from '../core/kit-fetcher.js';
import { copyKit } from '../core/copy-kit.js';
import { readInstalledVersion, recordInstalledVersion } from '../core/install-tracker.js';
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
  /** Opt into prereleases — move to the newest prerelease. */
  pre?: boolean;
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
      const kitVersion = await resolveKitTarget(opts);
      const fetch = await fetchKit({ version: kitVersion });
      if (!fetch.success) {
        results.push({ name: 'kit fetch', status: 'failed', detail: fetch.error });
      } else {
        results.push({ name: 'kit fetch', status: 'ok', detail: `v${fetch.version}` });
        recordInstalledVersion(fetch.version);

        // 2. Re-materialize templates (idempotent — preserves user memory).
        if (wantTemplates) {
          results.push(await runStep('templates', async () => {
            // Non-destructive: back up any customized shipped files to *.bak.
            const written = await copyKit(fetch.cachePath, targetAbs, { onConflict: 'backup' });
            return { detail: written.topLevel.join(', ') };
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

/**
 * Decide which kit version to materialize.
 *   - explicit `--kit-version` wins;
 *   - `--pre` → newest prerelease;
 *   - default → latest STABLE, but NEVER auto-downgrade: if the currently
 *     installed version is a prerelease newer than the latest stable, keep it
 *     and warn (cross-channel notice).
 * Returns undefined to let fetchKit resolve on its own.
 */
async function resolveKitTarget(opts: UpdateOptions): Promise<string | undefined> {
  if (opts.kitVersion) return opts.kitVersion;

  if (opts.pre) {
    const pre = await resolveLatestPrerelease();
    if (pre) {
      log.info(`Updating to newest prerelease v${pre}`);
      return pre;
    }
    log.warn('No prerelease found — falling back to default resolution.');
    return undefined;
  }

  const stable = await resolveLatestStable();
  const current = readInstalledVersion();

  if (current?.channel === 'pre') {
    if (stable && compareKitVersion(current.version, stable) > 0) {
      log.warn(
        `Keeping prerelease v${current.version} (newer than latest stable v${stable}). ` +
          'Use --pre for newer betas, or --version <x> to switch channels.',
      );
      return current.version;
    }
    if (!stable) {
      log.warn(
        `No stable release available — keeping v${current.version}. Use --version <x> to switch.`,
      );
      return current.version;
    }
    log.info(`Moving from prerelease v${current.version} to latest stable v${stable}.`);
    return stable;
  }

  if (stable) {
    log.info(`Updating to latest stable v${stable}`);
    return stable;
  }
  return undefined;
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
