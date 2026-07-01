/**
 * Unit tests for the ccsk namespace transform used when materializing the kit
 * into a project: skills → `/ccsk-<name>`, agents → bare name, with no damage to
 * stray `ccsk:`-like text.
 */
import { describe, it, expect } from 'vitest';
import { rewriteCcskNamespace } from '../src/core/rewrite-ccsk-namespace.js';

const ROSTER = {
  skills: ['plan', 'build', 'code-review', 'research', 'loop', 'guide', 'journal'],
  agents: ['planner', 'executor', 'code-reviewer', 'researcher', 'journal-writer'],
};

const rw = (t: string) => rewriteCcskNamespace(t, ROSTER);

describe('rewriteCcskNamespace', () => {
  it('rewrites skill slash-commands to the prefixed dir name', () => {
    expect(rw('route to /ccsk:plan first')).toBe('route to /ccsk-plan first');
    expect(rw('`/ccsk:build` — Forge')).toBe('`/ccsk-build` — Forge');
    expect(rw('╭─ 🔨 FORGE ─ /ccsk:build ─╮')).toBe('╭─ 🔨 FORGE ─ /ccsk-build ─╮');
  });

  it('rewrites agent delegation refs to the bare name', () => {
    expect(rw('spawn a separate `ccsk:code-reviewer` subagent')).toBe(
      'spawn a separate `code-reviewer` subagent',
    );
    expect(rw('subagent_type: ccsk:planner')).toBe('subagent_type: planner');
  });

  it('keeps the code-review skill and code-reviewer agent distinct', () => {
    expect(rw('/ccsk:code-review runs ccsk:code-reviewer')).toBe(
      '/ccsk-code-review runs code-reviewer',
    );
  });

  it('rewrites a bare skill mention to the prefixed dir name', () => {
    expect(rw('the ccsk:research skill')).toBe('the ccsk-research skill');
  });

  it('does not let a skill prefix corrupt a hyphenated agent slash-ref', () => {
    // `journal` (skill) must NOT eat `/ccsk:journal-writer`; the agent rule owns it.
    expect(rw('/ccsk:journal is a skill; ccsk:journal-writer is an agent')).toBe(
      '/ccsk-journal is a skill; journal-writer is an agent',
    );
  });

  it('does not touch stray ccsk: text or unrelated identifiers', () => {
    // Not in the roster → untouched.
    expect(rw('ccsk:unknown stays')).toBe('ccsk:unknown stays');
    // Marketplace/plugin refs have no colon → untouched.
    expect(rw('install ccsk@ccsk-kit from ccsk-org/ccsk-kit')).toBe(
      'install ccsk@ccsk-kit from ccsk-org/ccsk-kit',
    );
    // Already-materialized token is left alone on a re-run (idempotent).
    expect(rw('/ccsk-plan and code-reviewer')).toBe('/ccsk-plan and code-reviewer');
  });

  it('is idempotent', () => {
    const once = rw('/ccsk:plan · ccsk:planner · /ccsk:code-review · ccsk:code-reviewer');
    expect(rw(once)).toBe(once);
    expect(once).toBe('/ccsk-plan · planner · /ccsk-code-review · code-reviewer');
  });
});
