/**
 * Unit tests for copy-kit — the cache → target project copy.
 * Covers the `_dot_X → .X` rename, exclusions, overwrite, and the
 * returned top-level entry list. Runs against real temp dirs (no network).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyKit } from '../src/core/copy-kit.js';

let srcDir: string;
let targetDir: string;

async function write(root: string, rel: string, body = 'x'): Promise<void> {
  const p = path.join(root, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body, 'utf8');
}

const exists = async (p: string): Promise<boolean> =>
  fs.stat(p).then(() => true).catch(() => false);

beforeEach(async () => {
  srcDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccsk-src-'));
  targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccsk-dst-'));
});

afterEach(async () => {
  await fs.rm(srcDir, { recursive: true, force: true });
  await fs.rm(targetDir, { recursive: true, force: true });
});

describe('copyKit', () => {
  it('renames _dot_X segments to .X', async () => {
    await write(srcDir, '_dot_claude/commands/scaffold.md', 'hi');
    await write(srcDir, 'CLAUDE.md');

    await copyKit(srcDir, targetDir);

    expect(await exists(path.join(targetDir, '.claude/commands/scaffold.md'))).toBe(true);
    expect(await exists(path.join(targetDir, '_dot_claude'))).toBe(false);
    expect(await exists(path.join(targetDir, 'CLAUDE.md'))).toBe(true);
  });

  it('excludes settings.local.json and .DS_Store anywhere in the tree', async () => {
    await write(srcDir, '_dot_claude/settings.local.json');
    await write(srcDir, '.DS_Store');
    await write(srcDir, '_dot_claude/keep.json');

    await copyKit(srcDir, targetDir);

    expect(await exists(path.join(targetDir, '.claude/settings.local.json'))).toBe(false);
    expect(await exists(path.join(targetDir, '.DS_Store'))).toBe(false);
    expect(await exists(path.join(targetDir, '.claude/keep.json'))).toBe(true);
  });

  it('skips the root-level todo/ directory', async () => {
    await write(srcDir, 'todo/note.md');
    await write(srcDir, 'docs/keep.md');

    await copyKit(srcDir, targetDir);

    expect(await exists(path.join(targetDir, 'todo'))).toBe(false);
    expect(await exists(path.join(targetDir, 'docs/keep.md'))).toBe(true);
  });

  it('skips the root-level plugins/ and .claude-plugin/ (plugin source)', async () => {
    await write(srcDir, 'plugins/ccsk/skills/plan/SKILL.md');
    await write(srcDir, '.claude-plugin/marketplace.json');
    await write(srcDir, 'CLAUDE.md');
    await write(srcDir, '_dot_claude/keep.md');

    await copyKit(srcDir, targetDir);

    expect(await exists(path.join(targetDir, 'plugins'))).toBe(false);
    expect(await exists(path.join(targetDir, '.claude-plugin'))).toBe(false);
    expect(await exists(path.join(targetDir, 'CLAUDE.md'))).toBe(true);
    expect(await exists(path.join(targetDir, '.claude/keep.md'))).toBe(true);
  });

  it('skips the root-level .github/ directory', async () => {
    await write(srcDir, '.github/workflows/publish.yml');
    await write(srcDir, '.github/assets/build-cadence.svg');
    await write(srcDir, '_dot_claude/keep.md');

    await copyKit(srcDir, targetDir);

    expect(await exists(path.join(targetDir, '.github'))).toBe(false);
    expect(await exists(path.join(targetDir, '.claude/keep.md'))).toBe(true);
  });

  it('skips root README.md and VERSION but still ships CLAUDE.md', async () => {
    await write(srcDir, 'README.md');
    await write(srcDir, 'VERSION');
    await write(srcDir, 'CLAUDE.md');
    await write(srcDir, '_dot_claude/commands/keep.md', 'doc README.md inside is fine');

    await copyKit(srcDir, targetDir);

    expect(await exists(path.join(targetDir, 'README.md'))).toBe(false);
    expect(await exists(path.join(targetDir, 'VERSION'))).toBe(false);
    expect(await exists(path.join(targetDir, 'CLAUDE.md'))).toBe(true);
    expect(await exists(path.join(targetDir, '.claude/commands/keep.md'))).toBe(true);
  });

  it('overwrites an existing shipped file', async () => {
    await write(srcDir, 'CLAUDE.md', 'new');
    await write(targetDir, 'CLAUDE.md', 'old');

    await copyKit(srcDir, targetDir);

    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md'), 'utf8')).toBe('new');
  });

  it('preserves existing user memory (.ccsk/ outside templates) on re-copy', async () => {
    // Kit ships fresh seeds; user already has authored memory.
    await write(srcDir, '_dot_ccsk/MEMORY.md', 'fresh seed');
    await write(srcDir, '_dot_ccsk/plans/example/01-PLAN.md', 'example plan');
    await write(srcDir, '_dot_ccsk/journals/seed.md', 'seed journal');
    await write(targetDir, '.ccsk/MEMORY.md', 'MY MEMORY');
    await write(targetDir, '.ccsk/plans/example/01-PLAN.md', 'MY PLAN');
    await write(targetDir, '.ccsk/journals/seed.md', 'MY JOURNAL');

    await copyKit(srcDir, targetDir);

    expect(await fs.readFile(path.join(targetDir, '.ccsk/MEMORY.md'), 'utf8')).toBe('MY MEMORY');
    expect(await fs.readFile(path.join(targetDir, '.ccsk/plans/example/01-PLAN.md'), 'utf8')).toBe('MY PLAN');
    expect(await fs.readFile(path.join(targetDir, '.ccsk/journals/seed.md'), 'utf8')).toBe('MY JOURNAL');
  });

  it('seeds user memory when absent, and always refreshes templates', async () => {
    await write(srcDir, '_dot_ccsk/MEMORY.md', 'fresh seed');
    await write(srcDir, '_dot_ccsk/templates/PLAN.template.md', 'new template');
    await write(targetDir, '.ccsk/templates/PLAN.template.md', 'old template');

    await copyKit(srcDir, targetDir);

    // MEMORY.md was absent → seeded
    expect(await fs.readFile(path.join(targetDir, '.ccsk/MEMORY.md'), 'utf8')).toBe('fresh seed');
    // templates are scaffold → always overwritten
    expect(await fs.readFile(path.join(targetDir, '.ccsk/templates/PLAN.template.md'), 'utf8')).toBe('new template');
  });

  it('returns sorted, de-duplicated top-level destination names', async () => {
    await write(srcDir, '_dot_claude/a.md');
    await write(srcDir, '_dot_claude/b.md');
    await write(srcDir, 'CLAUDE.md');
    await write(srcDir, 'docs/x.md');

    const top = await copyKit(srcDir, targetDir);

    expect(top).toEqual(['.claude', 'CLAUDE.md', 'docs']);
  });
});
