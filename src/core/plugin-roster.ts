/**
 * Reads the ccsk plugin roster (agent names + skill entries) from a directory
 * that contains `plugins/ccsk/{agents,skills}` — either the fetched kit cache
 * (for counting what a kit ships) or a materialized project's `.claude/`.
 *
 * Shared by `install-summary` (display) and `materialize-plugin` (copy) so the
 * name set has a single source of truth.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface SkillEntry {
  name: string;
  invocable: boolean;
}

export interface PluginRoster {
  agents: string[];
  skills: SkillEntry[];
}

/** Reads the roster from `<srcDir>/plugins/ccsk/{agents,skills}`. */
export function readKitRoster(srcDir: string): PluginRoster {
  const base = path.join(srcDir, 'plugins', 'ccsk');
  return {
    agents: listMarkdownNames(path.join(base, 'agents')),
    skills: listSkills(path.join(base, 'skills')),
  };
}

/** Lists `*.md` basenames (without extension) in a dir, sorted; [] if absent. */
export function listMarkdownNames(dir: string): string[] {
  return readDirSafe(dir)
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name.replace(/\.md$/, ''))
    .sort();
}

/** Lists skill dirs (each holding a SKILL.md), flagging user-invocable ones. */
export function listSkills(dir: string): SkillEntry[] {
  return readDirSafe(dir)
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(dir, name, 'SKILL.md')))
    .sort()
    .map((name) => ({ name, invocable: isInvocable(path.join(dir, name, 'SKILL.md')) }));
}

/** A skill is invocable unless its frontmatter sets `user-invocable: false`. */
export function isInvocable(skillMd: string): boolean {
  try {
    const head = fs.readFileSync(skillMd, 'utf8').slice(0, 2000);
    return !/^user-invocable:\s*false\b/m.test(head);
  } catch {
    return true;
  }
}

/** `readdirSync` with dirents, returning [] instead of throwing on a missing dir. */
export function readDirSafe(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
