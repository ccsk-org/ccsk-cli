#!/usr/bin/env node
/**
 * Doc-drift guard. Fails (exit 1) when documentation references a `src/` module
 * that no longer exists, or when a core doc still contains a template placeholder.
 *
 * Scope is deliberately narrow to avoid flagging legitimate prose:
 *   - module references: any `src/<dir>/<file>.ts` token mentioned in docs/ or
 *     .claude/rules/ must resolve to a real file.
 *   - placeholders: the core docs must not contain `<project-name>`.
 *
 * Run: node scripts/check-doc-drift.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

/** Recursively list *.md files under a directory (skips node_modules). */
function listMarkdown(dir) {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(rel));
    else if (entry.name.endsWith('.md')) out.push(rel);
  }
  return out;
}

const docFiles = [...listMarkdown('docs'), ...listMarkdown('.claude/rules')];

// 1) Every referenced src module path must exist.
const moduleRef = /\bsrc\/(?:core|commands|util)\/[a-z0-9-]+\.ts\b/g;
for (const file of docFiles) {
  const text = readFileSync(path.join(root, file), 'utf8');
  for (const match of text.matchAll(moduleRef)) {
    const ref = match[0];
    if (!existsSync(path.join(root, ref))) {
      errors.push(`${file}: references missing module \`${ref}\``);
    }
  }
}

// 2) Core docs must not carry template placeholders.
const coreDocs = [
  'docs/project-overview-pdr.md',
  'docs/project-roadmap.md',
  'docs/system-architecture.md',
  'docs/code-standards.md',
  'docs/codebase-summary.md',
  'docs/technical-stacks.md',
  'docs/design-guidelines.md',
  'docs/deployment-guide.md',
];
for (const file of coreDocs) {
  const abs = path.join(root, file);
  if (!existsSync(abs)) continue;
  if (readFileSync(abs, 'utf8').includes('<project-name>')) {
    errors.push(`${file}: still contains the \`<project-name>\` template placeholder`);
  }
}

if (errors.length) {
  console.error('Doc-drift check failed:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`Doc-drift check passed (${docFiles.length} docs scanned).`);
