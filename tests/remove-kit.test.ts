/**
 * Unit tests for remove-kit — the inverse of copy-kit used by `ccsk uninstall`.
 * Safety-critical properties:
 *   - default mode removes SCAFFOLD only and PRESERVES user memory;
 *   - never touches unrelated user files;
 *   - --purge-memory backs memory up (move, not rm) before removing it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  removeKit,
  existingKitPaths,
  existingUserMemoryPaths,
  SCAFFOLD_PATHS,
  USER_MEMORY_PATHS,
} from '../src/core/remove-kit.js';

let targetDir: string;

async function write(rel: string, body = 'x'): Promise<void> {
  const p = path.join(targetDir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body, 'utf8');
}

const exists = async (rel: string): Promise<boolean> =>
  fs.stat(path.join(targetDir, rel)).then(() => true).catch(() => false);

/** Seed a full kit: scaffold + templates + user memory. */
async function seedFullKit(): Promise<void> {
  await write('CLAUDE.md');
  await write('.mcp.json');
  await write('.claude/rules/x.md');
  await write('docs/overview.md');
  await write('.ccsk/templates/PLAN.template.md');
  await write('.ccsk/MEMORY.md', 'my durable memory');
  await write('.ccsk/plans/250101-foo/01-PLAN.md', 'my plan');
  await write('.ccsk/journals/j.md');
}

beforeEach(async () => {
  targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccsk-rm-'));
});

afterEach(async () => {
  await fs.rm(targetDir, { recursive: true, force: true });
});

describe('existingKitPaths / existingUserMemoryPaths', () => {
  it('reports only the kit paths that are present', async () => {
    await write('CLAUDE.md');
    await write('.claude/x.md');

    const found = await existingKitPaths(targetDir);
    expect(found.sort()).toEqual(['.claude', 'CLAUDE.md']);
  });

  it('separates user-memory paths from scaffold', async () => {
    await seedFullKit();
    const memory = await existingUserMemoryPaths(targetDir);
    expect(memory).toContain(path.join('.ccsk', 'MEMORY.md'));
    expect(memory).toContain(path.join('.ccsk', 'plans'));
    expect(memory).toContain(path.join('.ccsk', 'journals'));
    expect(memory).not.toContain(path.join('.ccsk', 'templates'));
  });
});

describe('removeKit — default (preserve user memory)', () => {
  it('removes scaffold (incl. .ccsk/templates) but preserves user memory', async () => {
    await seedFullKit();

    const result = await removeKit(targetDir);

    // scaffold gone
    expect(await exists('CLAUDE.md')).toBe(false);
    expect(await exists('.claude')).toBe(false);
    expect(await exists('.mcp.json')).toBe(false);
    expect(await exists('docs')).toBe(false);
    expect(await exists('.ccsk/templates')).toBe(false);

    // user memory preserved
    expect(await exists('.ccsk/MEMORY.md')).toBe(true);
    expect(await exists('.ccsk/plans/250101-foo/01-PLAN.md')).toBe(true);
    expect(await exists('.ccsk/journals/j.md')).toBe(true);

    expect(result.preserved).toContain(path.join('.ccsk', 'MEMORY.md'));
    expect(result.preserved).toContain(path.join('.ccsk', 'plans'));
    expect(result.backupDir).toBeUndefined();
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
    const result = await removeKit(targetDir);
    expect(result.removed).toEqual([]);
    expect(await exists('README.md')).toBe(true);
  });
});

describe('removeKit — --purge-memory (backup, then remove)', () => {
  it('moves .ccsk to a timestamped backup instead of deleting it', async () => {
    await seedFullKit();

    const result = await removeKit(targetDir, { purgeMemory: true });

    // .ccsk removed from its original location
    expect(await exists('.ccsk')).toBe(false);
    // ...but backed up, not destroyed
    expect(result.backupDir).toBeDefined();
    const backupRel = path.relative(targetDir, result.backupDir!);
    expect(backupRel).toMatch(/^\.ccsk\.bak-\d{8}-\d{6}$/);
    expect(await exists(path.join(backupRel, 'MEMORY.md'))).toBe(true);
    expect(await exists(path.join(backupRel, 'plans/250101-foo/01-PLAN.md'))).toBe(true);

    // non-.ccsk scaffold still removed
    expect(await exists('CLAUDE.md')).toBe(false);
    expect(await exists('.claude')).toBe(false);
    expect(result.preserved).toEqual([]);
  });
});

describe('path constants', () => {
  it('templates is scaffold; memory dirs are user memory', () => {
    expect(SCAFFOLD_PATHS).toContain(path.join('.ccsk', 'templates'));
    expect(USER_MEMORY_PATHS).toContain(path.join('.ccsk', 'MEMORY.md'));
    expect(USER_MEMORY_PATHS).toContain(path.join('.ccsk', 'plans'));
  });
});
