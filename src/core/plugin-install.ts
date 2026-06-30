/**
 * Claude Code PLUGIN orchestration for the ccsk kit.
 *
 * The kit is distributed as a hybrid: materialized templates (copied by
 * copy-kit) PLUS a Claude Code plugin that is installed via the `claude plugin`
 * CLI rather than copied into the project. The plugin lives inside the fetched
 * kit cache under `.claude-plugin/marketplace.json` (marketplace `ccsk-kit`,
 * plugin `ccsk`).
 *
 * Pinning: `claude plugin marketplace add` has NO `--version` flag, so we pin by
 * pointing the marketplace at the LOCAL cache directory that the CLI already
 * cloned at the resolved version (`~/.ccsk/kit/<version>`). A local-path source
 * needs no re-clone and uses no GitHub credentials — sidestepping the fact that
 * `claude`'s own marketplace clone uses its own credential path (gh/ssh/
 * GITHUB_TOKEN) which may not reach a private kit repo.
 *
 * Every function returns a StepResult and never throws — callers run these as
 * non-aborting setup steps.
 */

import { execa } from 'execa';
import { binExists } from '../util/platform.js';
import { log } from '../util/log.js';
import type { StepResult } from './step-result.js';

/** Marketplace name as declared in the kit's `.claude-plugin/marketplace.json`. */
export const MARKETPLACE_NAME = 'ccsk-kit';
/** Plugin name within the marketplace. */
export const PLUGIN_NAME = 'ccsk';
/** Fully-qualified `<plugin>@<marketplace>` install reference. */
export const PLUGIN_REF = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

export type PluginScope = 'user' | 'project';

export interface PluginOptions {
  /** Marketplace source — the local kit cache path (pins to the resolved version). */
  source: string;
  /** Install scope. `project` makes it travel with the repo; default in callers. */
  scope: PluginScope;
}

/** Lowercased message text that means "this is already done" — treat as success. */
function isAlreadyDone(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('already exists') ||
    m.includes('already installed') ||
    m.includes('already added') ||
    m.includes('already registered')
  );
}

/** Lowercased message text that smells like a credential/clone failure. */
function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('permission denied') ||
    m.includes('authentication') ||
    m.includes('could not read') ||
    m.includes('repository not found') ||
    m.includes('403') ||
    m.includes('401')
  );
}

/** Adds (or re-points) the ccsk marketplace from the local cache path. */
async function marketplaceAdd(opts: PluginOptions): Promise<{ ok: boolean; detail: string }> {
  const { exitCode, stderr, stdout } = await execa(
    'claude',
    ['plugin', 'marketplace', 'add', opts.source, '--scope', opts.scope],
    { reject: false },
  );
  if (exitCode === 0) return { ok: true, detail: 'marketplace added' };
  const errMsg = (stderr || stdout || `exit ${exitCode}`).trim();
  if (isAlreadyDone(errMsg)) return { ok: true, detail: 'marketplace already added' };
  if (isAuthError(errMsg)) {
    log.warn('claude could not reach the kit marketplace source.');
    log.hint('  claude clones marketplaces with its own credentials (gh/ssh/GITHUB_TOKEN).');
    log.hint('  Using the local cache path avoids this — ensure the kit was fetched first.');
  }
  return { ok: false, detail: errMsg };
}

/**
 * Installs the ccsk plugin: add the marketplace (pinned to the cache path), then
 * install the plugin non-interactively (`--scope` skips the prompt). Re-running
 * an installed plugin exits 0 ("already installed"), tolerated as success.
 */
export async function installCcskPlugin(opts: PluginOptions): Promise<StepResult> {
  const name = 'ccsk plugin';
  if (!(await binExists('claude'))) {
    return { name, status: 'skipped', detail: 'claude CLI not found' };
  }

  const market = await marketplaceAdd(opts);
  if (!market.ok) return { name, status: 'failed', detail: market.detail };

  const { exitCode, stderr, stdout } = await execa(
    'claude',
    ['plugin', 'install', PLUGIN_REF, '--scope', opts.scope],
    { reject: false },
  );
  if (exitCode === 0) return { name, status: 'ok', detail: `installed (${opts.scope})` };
  const errMsg = (stderr || stdout || `exit ${exitCode}`).trim();
  if (isAlreadyDone(errMsg)) return { name, status: 'skipped', detail: 'already installed' };
  return { name, status: 'failed', detail: errMsg };
}

/**
 * Updates the ccsk plugin to the freshly-fetched version. Re-points the
 * marketplace at the new cache path first (each version is a distinct cache
 * dir), then runs `claude plugin update ccsk`. Used by `ccsk update`.
 */
export async function updateCcskPlugin(opts: PluginOptions): Promise<StepResult> {
  const name = 'ccsk plugin update';
  if (!(await binExists('claude'))) {
    return { name, status: 'skipped', detail: 'claude CLI not found' };
  }

  // Re-point the marketplace at the new cache path so the update resolves the
  // freshly-fetched version. add tolerates an existing entry; ensure it points
  // at the new source by removing a stale entry first (non-fatal if absent).
  await execa('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME], { reject: false });
  const market = await marketplaceAdd(opts);
  if (!market.ok) return { name, status: 'failed', detail: market.detail };

  // Ensure the plugin is installed at the new source, then ask claude to update.
  await execa('claude', ['plugin', 'install', PLUGIN_REF, '--scope', opts.scope], { reject: false });
  const { exitCode, stderr, stdout } = await execa('claude', ['plugin', 'update', PLUGIN_NAME], {
    reject: false,
  });
  if (exitCode === 0) return { name, status: 'ok', detail: 'updated' };
  const errMsg = (stderr || stdout || `exit ${exitCode}`).trim();
  if (isAlreadyDone(errMsg) || errMsg.toLowerCase().includes('up to date')) {
    return { name, status: 'skipped', detail: 'already up to date' };
  }
  return { name, status: 'failed', detail: errMsg };
}

/**
 * Removes the ccsk plugin + marketplace during uninstall. Best-effort and
 * non-fatal — a missing plugin/marketplace is reported as skipped.
 */
export async function removeCcskPlugin(): Promise<StepResult> {
  const name = 'ccsk plugin';
  if (!(await binExists('claude'))) {
    return { name, status: 'skipped', detail: 'claude CLI not found' };
  }

  let removedAny = false;
  const uninstall = await execa('claude', ['plugin', 'uninstall', PLUGIN_NAME], { reject: false });
  if (uninstall.exitCode === 0) removedAny = true;

  const market = await execa('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME], {
    reject: false,
  });
  if (market.exitCode === 0) removedAny = true;

  return removedAny
    ? { name, status: 'ok', detail: 'plugin + marketplace removed' }
    : { name, status: 'skipped', detail: 'not installed' };
}
