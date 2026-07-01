/**
 * Unit tests for copy-kit — the cache → target project copy.
 * Covers the `_dot_X → .X` rename, exclusions, non-destructive conflict
 * handling (backup / keep), `findConflicts`, and the returned result.
 * Runs against real temp dirs (no network).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyKit, findConflicts } from '../src/core/copy-kit.js';

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

  it("default 'backup' policy backs up an existing shipped file to *.bak, then installs ours", async () => {
    await write(srcDir, 'CLAUDE.md', 'new');
    await write(targetDir, 'CLAUDE.md', 'old');

    const res = await copyKit(srcDir, targetDir);

    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md'), 'utf8')).toBe('new');
    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md.bak'), 'utf8')).toBe('old');
    expect(res.backedUp).toEqual(['CLAUDE.md']);
    expect(res.kept).toEqual([]);
  });

  it("'keep' policy leaves the user's file and writes ours as *.ccsk.bak", async () => {
    await write(srcDir, 'CLAUDE.md', 'new');
    await write(targetDir, 'CLAUDE.md', 'old');

    const res = await copyKit(srcDir, targetDir, { onConflict: 'keep' });

    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md'), 'utf8')).toBe('old');
    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md.ccsk.bak'), 'utf8')).toBe('new');
    expect(res.kept).toEqual(['CLAUDE.md']);
    expect(res.backedUp).toEqual([]);
  });

  it('does not touch files that do not already exist (no spurious backups)', async () => {
    await write(srcDir, 'CLAUDE.md', 'new');

    const res = await copyKit(srcDir, targetDir);

    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md'), 'utf8')).toBe('new');
    expect(await exists(path.join(targetDir, 'CLAUDE.md.bak'))).toBe(false);
    expect(res.backedUp).toEqual([]);
  });

  it('disambiguates a *.bak name collision with a timestamp rather than clobbering', async () => {
    await write(srcDir, 'CLAUDE.md', 'new');
    await write(targetDir, 'CLAUDE.md', 'old');
    await write(targetDir, 'CLAUDE.md.bak', 'a prior backup');

    await copyKit(srcDir, targetDir);

    // The prior backup is preserved untouched...
    expect(await fs.readFile(path.join(targetDir, 'CLAUDE.md.bak'), 'utf8')).toBe('a prior backup');
    // ...and the just-replaced file landed in a timestamped sibling.
    const stamped = (await fs.readdir(targetDir)).filter((e) => e.startsWith('CLAUDE.md.bak.'));
    expect(stamped).toHaveLength(1);
    expect(await fs.readFile(path.join(targetDir, stamped[0]), 'utf8')).toBe('old');
    // ...and ours is installed.
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

    const res = await copyKit(srcDir, targetDir);

    expect(await fs.readFile(path.join(targetDir, '.ccsk/MEMORY.md'), 'utf8')).toBe('MY MEMORY');
    expect(await fs.readFile(path.join(targetDir, '.ccsk/plans/example/01-PLAN.md'), 'utf8')).toBe('MY PLAN');
    expect(await fs.readFile(path.join(targetDir, '.ccsk/journals/seed.md'), 'utf8')).toBe('MY JOURNAL');
    // User memory is preserved outright — never backed up to *.bak.
    expect(await exists(path.join(targetDir, '.ccsk/MEMORY.md.bak'))).toBe(false);
    expect(res.backedUp).toEqual([]);
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

    const { topLevel } = await copyKit(srcDir, targetDir);

    expect(topLevel).toEqual(['.claude', 'CLAUDE.md', 'docs']);
  });

  it('returns every shipped destination path (renamed, sorted)', async () => {
    await write(srcDir, '_dot_claude/rules/common.md');
    await write(srcDir, 'CLAUDE.md');
    await write(srcDir, 'docs/x.md');

    const { files } = await copyKit(srcDir, targetDir);

    expect(files).toEqual(
      ['CLAUDE.md', path.join('.claude', 'rules', 'common.md'), path.join('docs', 'x.md')].sort(),
    );
  });
});

describe('findConflicts', () => {
  it('reports shipped files that already exist, excluding user memory', async () => {
    await write(srcDir, 'CLAUDE.md');
    await write(srcDir, '_dot_claude/rules/common.md');
    await write(srcDir, 'docs/new.md');
    await write(srcDir, '_dot_ccsk/MEMORY.md'); // user memory — never a conflict

    // Target already has CLAUDE.md, a rule, and authored memory.
    await write(targetDir, 'CLAUDE.md', 'mine');
    await write(targetDir, '.claude/rules/common.md', 'mine');
    await write(targetDir, '.ccsk/MEMORY.md', 'MY MEMORY');

    const conflicts = await findConflicts(srcDir, targetDir);

    expect(conflicts.sort()).toEqual(['CLAUDE.md', path.join('.claude', 'rules', 'common.md')].sort());
    expect(conflicts).not.toContain(path.join('.ccsk', 'MEMORY.md'));
  });

  it('returns an empty list for a clean target', async () => {
    await write(srcDir, 'CLAUDE.md');
    await write(srcDir, 'docs/x.md');

    expect(await findConflicts(srcDir, targetDir)).toEqual([]);
  });
});
