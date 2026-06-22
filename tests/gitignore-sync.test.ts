/**
 * Unit tests for gitignore-sync — the marker-fenced `.gitignore` block.
 * Key property: idempotent. Create → merge → replace, never touching lines
 * outside the fence, and re-running converges (no duplicate blocks).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureCcskGitignoreBlock } from '../src/util/gitignore-sync.js';

const MARKER = '# ----- ccsk gitignore -----';
let targetDir: string;
const gitignore = (): string => path.join(targetDir, '.gitignore');
const read = (): string => fs.readFileSync(gitignore(), 'utf8');
const markerCount = (s: string): number => s.split(MARKER).length - 1;

beforeEach(async () => {
  targetDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ccsk-gi-'));
});

afterEach(async () => {
  await fsp.rm(targetDir, { recursive: true, force: true });
});

describe('ensureCcskGitignoreBlock', () => {
  it('creates the file with one fenced block when absent', () => {
    expect(ensureCcskGitignoreBlock(targetDir)).toBe('created');
    const body = read();
    expect(markerCount(body)).toBe(2); // open + close
    expect(body).toContain('.ccsk/');
  });

  it('merges into an existing .gitignore, preserving prior lines', () => {
    fs.writeFileSync(gitignore(), 'node_modules\ndist\n', 'utf8');

    expect(ensureCcskGitignoreBlock(targetDir)).toBe('merged');
    const body = read();
    expect(body).toContain('node_modules');
    expect(body).toContain('dist');
    expect(markerCount(body)).toBe(2);
  });

  it('replaces the existing fenced block in place (no duplicates)', () => {
    fs.writeFileSync(gitignore(), 'node_modules\n', 'utf8');
    ensureCcskGitignoreBlock(targetDir); // merged

    const result = ensureCcskGitignoreBlock(targetDir); // replaced
    expect(result).toBe('replaced');
    expect(markerCount(read())).toBe(2);
  });

  it('is idempotent across repeated runs', () => {
    ensureCcskGitignoreBlock(targetDir);
    ensureCcskGitignoreBlock(targetDir);
    ensureCcskGitignoreBlock(targetDir);
    const body = read();
    expect(markerCount(body)).toBe(2);
  });

  it('keeps user lines outside the fence untouched on replace', () => {
    fs.writeFileSync(gitignore(), 'keep-me\n', 'utf8');
    ensureCcskGitignoreBlock(targetDir);
    ensureCcskGitignoreBlock(targetDir);
    expect(read()).toContain('keep-me');
  });
});
