/**
 * Materializes the ccsk plugin's agents + skills INTO a target project so the
 * kit is self-contained and visible — the default delivery model.
 *
 * Source: the fetched kit cache `<srcDir>/plugins/ccsk/{agents,skills}`.
 * Destination:
 *   - agents → `<target>/.claude/agents/<name>.md`     (bare name = subagent_type)
 *   - skills → `<target>/.claude/skills/ccsk-<name>/**` (prefixed dir → `/ccsk-<name>`)
 * Every `.md` body is run through {@link rewriteCcskNamespace} so the plugin
 * `ccsk:` namespace becomes plugin-less-project-correct.
 *
 * ccsk-owned output: on re-init these dirs are refreshed (overwrite), mirroring
 * how `.ccsk/templates` is treated by copyKit. User files elsewhere are untouched.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { readKitRoster } from './plugin-roster.js';
import { rewriteCcskNamespace } from './rewrite-ccsk-namespace.js';

export interface MaterializeResult {
  /** Number of agent files written. */
  agents: number;
  /** Number of skill dirs written (each `ccsk-<name>`). */
  skills: number;
  /** Destination-relative paths written (`.claude/...`, sorted). */
  files: string[];
}

/** Prefixes a skill dir name so its slash-command is collision-safe (`/ccsk-<name>`). */
export function materializedSkillDir(name: string): string {
  return `ccsk-${name}`;
}

/**
 * Copies + rewrites the plugin roster into `<targetAbs>/.claude/`. Returns counts
 * and the written file list. Throws only on unexpected I/O errors.
 */
export async function materializePlugin(
  srcDir: string,
  targetAbs: string,
): Promise<MaterializeResult> {
  const roster = readKitRoster(srcDir);
  const names = { skills: roster.skills.map((s) => s.name), agents: roster.agents };
  const rewrite = (text: string): string => rewriteCcskNamespace(text, names);

  const written: string[] = [];
  const pluginBase = path.join(srcDir, 'plugins', 'ccsk');

  // Agents → .claude/agents/<name>.md (bare filenames; rewrite bodies).
  // Overwrite only the ccsk-owned files — never wipe the dir, so a user's own
  // agents in .claude/agents are preserved (a same-named user agent IS replaced,
  // an inherent consequence of the bare-name materialization).
  const agentsSrc = path.join(pluginBase, 'agents');
  const agentsDest = path.join(targetAbs, '.claude', 'agents');
  await fs.mkdir(agentsDest, { recursive: true });
  for (const agent of roster.agents) {
    const rel = path.join('.claude', 'agents', `${agent}.md`);
    await writeRewritten(path.join(agentsSrc, `${agent}.md`), path.join(targetAbs, rel), rewrite);
    written.push(rel);
  }

  // Skills → .claude/skills/ccsk-<name>/** (prefixed dir; rewrite every .md).
  const skillsSrc = path.join(pluginBase, 'skills');
  for (const { name } of roster.skills) {
    const destDirRel = path.join('.claude', 'skills', materializedSkillDir(name));
    await copyTreeRewritten(
      path.join(skillsSrc, name),
      path.join(targetAbs, destDirRel),
      destDirRel,
      rewrite,
      written,
    );
  }

  written.sort();
  return { agents: roster.agents.length, skills: roster.skills.length, files: written };
}

/** Removes a dir (if present) then recreates it empty — refresh ccsk-owned output. */
async function refreshDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Recursively copies `srcDir` → `destDir`. `.md` files are rewritten; anything
 * else is copied verbatim. Appends each written destination-relative path to
 * `written`. The destination dir is refreshed first (ccsk-owned).
 */
async function copyTreeRewritten(
  srcDir: string,
  destDir: string,
  destRel: string,
  rewrite: (t: string) => string,
  written: string[],
): Promise<void> {
  await refreshDir(destDir);
  await walk(srcDir, destDir, destRel);

  async function walk(s: string, d: string, rel: string): Promise<void> {
    const entries = await fs.readdir(s, { withFileTypes: true });
    for (const e of entries) {
      const sChild = path.join(s, e.name);
      const dChild = path.join(d, e.name);
      const relChild = path.join(rel, e.name);
      if (e.isDirectory()) {
        await fs.mkdir(dChild, { recursive: true });
        await walk(sChild, dChild, relChild);
      } else if (e.isFile()) {
        if (e.name.endsWith('.md')) {
          await writeRewritten(sChild, dChild, rewrite);
        } else {
          await fs.copyFile(sChild, dChild);
        }
        written.push(relChild);
      }
    }
  }
}

/** Reads a source file, rewrites its contents, and writes it to `dest`. */
async function writeRewritten(
  src: string,
  dest: string,
  rewrite: (t: string) => string,
): Promise<void> {
  const body = await fs.readFile(src, 'utf8');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, rewrite(body), 'utf8');
}

/**
 * Normalizes the already-materialized contract (`CLAUDE.md` + `.claude/rules/*.md`)
 * in place so their `ccsk:` command/delegation tokens match the materialized
 * project (`/ccsk-<skill>`, bare `<agent>`). Rewrites only files that change.
 * Returns the destination-relative paths that were modified.
 */
export async function normalizeMaterializedContract(
  targetAbs: string,
  srcDir: string,
): Promise<string[]> {
  const roster = readKitRoster(srcDir);
  const names = { skills: roster.skills.map((s) => s.name), agents: roster.agents };
  const changed: string[] = [];

  const targets = [
    'CLAUDE.md',
    ...(await listMd(path.join(targetAbs, '.claude', 'rules'))).map((f) =>
      path.join('.claude', 'rules', f),
    ),
  ];

  for (const rel of targets) {
    const abs = path.join(targetAbs, rel);
    let body: string;
    try {
      body = await fs.readFile(abs, 'utf8');
    } catch {
      continue; // file absent (e.g. no CLAUDE.md) — skip
    }
    const next = rewriteCcskNamespace(body, names);
    if (next !== body) {
      await fs.writeFile(abs, next, 'utf8');
      changed.push(rel);
    }
  }

  return changed;
}

/** Lists `*.md` filenames in a dir; [] if the dir is absent. */
async function listMd(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}
