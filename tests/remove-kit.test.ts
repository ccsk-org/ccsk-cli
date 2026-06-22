/**
 * Unit tests for remove-kit — the inverse of copy-kit used by `ccsk uninstall`.
 * The safety-critical property: it removes ONLY the kit whitelist and never
 * touches unrelated user files.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { removeKit, existingKitPaths, KIT_PATHS } from '../src/core/remove-kit.js';

let targetDir: string;

async function write(rel: string, body = 'x'): Promise<void> {
  const p = path.join(targetDir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body, 'utf8');
}

const exists = async (rel: string): Promise<boolean> =>
  fs.stat(path.join(targetDir, rel)).then(() => true).catch(() => false);

beforeEach(async () => {
  targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccsk-rm-'));
});

afterEach(async () => {
  await fs.rm(targetDir, { recursive: true, force: true });
});

describe('existingKitPaths', () => {
  it('reports only the kit paths that are present', async () => {
    await write('CLAUDE.md');
    await write('.claude/x.md');
    // .mcp.json, docs, .ccsk intentionally absent

    const found = await existingKitPaths(targetDir);
    expect(found.sort()).toEqual(['.claude', 'CLAUDE.md']);
  });
});

describe('removeKit', () => {
  it('removes every present kit path and returns them', async () => {
    for (const name of KIT_PATHS) await write(path.join(name, 'f.md'));

    const removed = await removeKit(targetDir);

    expect(removed.sort()).toEqual([...KIT_PATHS].sort());
    for (const name of KIT_PATHS) expect(await exists(name)).toBe(false);
  });

  it('never deletes files outside the whitelist', async () => {
    await write('CLAUDE.md');
    await write('src/index.ts', 'user code');
    await write('package.json', '{}');
    await write('README.md');

    await removeKit(targetDir);

    expect(await exists('CLAUDE.md')).toBe(false);
    expect(await exists('src/index.ts')).toBe(true);
    expect(await exists('package.json')).toBe(true);
    expect(await exists('README.md')).toBe(true);
  });

  it('is a no-op when no kit paths exist', async () => {
    await write('README.md');
    const removed = await removeKit(targetDir);
    expect(removed).toEqual([]);
    expect(await exists('README.md')).toBe(true);
  });
});
