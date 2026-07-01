/**
 * Unit tests for the RTK → CLAUDE.md purity wiring: `wireRtkInstructions`
 * writes the rule file and inserts a single contract-style import, idempotently.
 * `rtkInit`'s CLAUDE.md snapshot/restore is covered indirectly (it needs the
 * external `rtk` binary); here we test the pure file-wiring logic, which runs
 * only when `rtk` is on PATH.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// `wireRtkInstructions` guards on `binExists('rtk')`; force it true so the
// pure file-wiring path runs deterministically without the real binary.
vi.mock('../src/util/platform.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/util/platform.js')>();
  return { ...actual, binExists: vi.fn(async (b: string) => b === 'rtk') };
});

const { wireRtkInstructions } = await import('../src/core/rtk.js');

let targetDir: string;
const CONTRACT = `# CLAUDE.md

## The contract (rules — always on)

@.claude/rules/primary-workflows.md
@.claude/rules/common-rules.md

## Non-negotiables
`;

beforeEach(async () => {
  targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccsk-rtk-'));
});
afterEach(async () => {
  await fs.rm(targetDir, { recursive: true, force: true });
});

const readClaude = () => fs.readFile(path.join(targetDir, 'CLAUDE.md'), 'utf8');

describe('wireRtkInstructions', () => {
  it('writes the rule file and inserts the import after the last rule import', async () => {
    await fs.writeFile(path.join(targetDir, 'CLAUDE.md'), CONTRACT, 'utf8');

    const res = await wireRtkInstructions(targetDir);
    expect(res.status).toBe('ok');

    const rule = await fs.readFile(
      path.join(targetDir, '.claude', 'rules', 'rtk-instructions.md'),
      'utf8',
    );
    expect(rule).toContain('RTK — Rust Token Killer');

    const claude = await readClaude();
    expect(claude).toContain('@.claude/rules/rtk-instructions.md');
    // Inserted directly after the last existing rule import, before Non-negotiables.
    const importIdx = claude.indexOf('@.claude/rules/rtk-instructions.md');
    const commonIdx = claude.indexOf('@.claude/rules/common-rules.md');
    const nonNegIdx = claude.indexOf('## Non-negotiables');
    expect(importIdx).toBeGreaterThan(commonIdx);
    expect(importIdx).toBeLessThan(nonNegIdx);
  });

  it('is idempotent — a second run does not duplicate the import', async () => {
    await fs.writeFile(path.join(targetDir, 'CLAUDE.md'), CONTRACT, 'utf8');

    await wireRtkInstructions(targetDir);
    const second = await wireRtkInstructions(targetDir);
    expect(second.status).toBe('skipped');

    const claude = await readClaude();
    const occurrences = claude.split('@.claude/rules/rtk-instructions.md').length - 1;
    expect(occurrences).toBe(1);
  });

  it('appends a fallback section when CLAUDE.md has no rule-import block', async () => {
    await fs.writeFile(path.join(targetDir, 'CLAUDE.md'), '# CLAUDE.md\n\nno imports here\n', 'utf8');

    const res = await wireRtkInstructions(targetDir);
    expect(res.status).toBe('ok');

    const claude = await readClaude();
    expect(claude).toContain('## RTK (optional tool');
    expect(claude).toContain('@.claude/rules/rtk-instructions.md');
  });
});
