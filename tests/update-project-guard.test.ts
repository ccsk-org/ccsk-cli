/**
 * Guard tests for `ccsk update`: kit materialization (templates + agents/skills
 * + plugin) must run ONLY when the target is already a ccsk project, or the user
 * opted in via `--force` / an explicit `--path`. The global CLI self-update runs
 * regardless. Prevents `ccsk update` from dumping kit files into an arbitrary cwd.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Mock every collaborator that touches the network or filesystem so the test
// asserts *whether* materialization was attempted, not its side effects.
vi.mock('../src/core/self-update.js', () => ({ runSelfUpdate: vi.fn(async () => {}) }));
vi.mock('../src/core/github-auth.js', () => ({
  detectAuthMethod: vi.fn(async () => ({ method: 'gh', username: 'tester' })),
}));
vi.mock('../src/core/kit-fetcher.js', () => ({
  fetchKit: vi.fn(async () => ({ success: true, version: '2.0.0', cachePath: '/tmp/ccsk-cache' })),
  resolveLatestStable: vi.fn(async () => '2.0.0'),
  resolveLatestPrerelease: vi.fn(async () => '2.0.0-beta-06'),
  compareKitVersion: vi.fn(() => 0),
}));
vi.mock('../src/core/copy-kit.js', () => ({
  copyKit: vi.fn(async () => ({ topLevel: ['CLAUDE.md'] })),
}));
vi.mock('../src/core/install-tracker.js', () => ({
  readInstalledVersion: vi.fn(() => null),
  recordInstalledVersion: vi.fn(() => {}),
}));
vi.mock('../src/core/plugin-install.js', () => ({
  updateCcskPlugin: vi.fn(async () => ({ name: 'plugin', status: 'ok', detail: 'updated' })),
}));
vi.mock('../src/core/materialize-plugin.js', () => ({
  materializePlugin: vi.fn(async () => ({ agents: 3, skills: 5 })),
  normalizeMaterializedContract: vi.fn(async () => []),
}));

import { runUpdate } from '../src/commands/update.js';
import { runSelfUpdate } from '../src/core/self-update.js';
import { fetchKit } from '../src/core/kit-fetcher.js';
import { copyKit } from '../src/core/copy-kit.js';

let tmp: string;
let cwd0: string;

beforeEach(async () => {
  vi.clearAllMocks();
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-update-guard-'));
  cwd0 = process.cwd();
});
afterEach(async () => {
  process.chdir(cwd0);
  await fsp.rm(tmp, { recursive: true, force: true });
});

const markCcskProject = () => fs.mkdirSync(path.join(tmp, '.ccsk'), { recursive: true });
const markMaterialized = () =>
  fs.mkdirSync(path.join(tmp, '.claude', 'skills', 'ccsk-plan'), { recursive: true });

describe('ccsk update — project guard', () => {
  it('skips kit materialization in a non-project cwd (still self-updates the CLI)', async () => {
    process.chdir(tmp);
    await runUpdate({ version: 'latest' });

    expect(runSelfUpdate).toHaveBeenCalledOnce();
    expect(fetchKit).not.toHaveBeenCalled();
    expect(copyKit).not.toHaveBeenCalled();
  });

  it('materializes when the cwd is a ccsk project (.ccsk/ present)', async () => {
    markCcskProject();
    process.chdir(tmp);
    await runUpdate({ version: 'latest' });

    expect(fetchKit).toHaveBeenCalledOnce();
    expect(copyKit).toHaveBeenCalledOnce();
  });

  it('detects a materialized project via .claude/skills/ccsk-* when .ccsk/ is absent', async () => {
    markMaterialized();
    process.chdir(tmp);
    await runUpdate({ version: 'latest' });

    expect(copyKit).toHaveBeenCalledOnce();
  });

  it('--force bypasses the guard in a non-project cwd', async () => {
    process.chdir(tmp);
    await runUpdate({ version: 'latest', force: true });

    expect(copyKit).toHaveBeenCalledOnce();
  });

  it('an explicit --path bypasses the guard even for a non-project target', async () => {
    // cwd is a guaranteed non-project dir; targetPath names a separate empty dir,
    // so a copyKit call can only come from the explicit-path bypass.
    const cwd = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-update-cwd-'));
    process.chdir(cwd);
    await runUpdate({ version: 'latest', targetPath: tmp });

    expect(copyKit).toHaveBeenCalledOnce();
    await fsp.rm(cwd, { recursive: true, force: true });
  });

  it('never touches the kit when both --no-templates and --no-plugin are set', async () => {
    markCcskProject();
    process.chdir(tmp);
    await runUpdate({ version: 'latest', templates: false, plugin: false });

    expect(runSelfUpdate).toHaveBeenCalledOnce();
    expect(fetchKit).not.toHaveBeenCalled();
    expect(copyKit).not.toHaveBeenCalled();
  });
});
