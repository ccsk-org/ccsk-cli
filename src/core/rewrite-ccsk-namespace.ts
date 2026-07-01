/**
 * Rewrites the plugin `ccsk:` namespace out of materialized kit files.
 *
 * The kit source is authored for the plugin, where skills invoke as `/ccsk:plan`
 * and agents are spawned as `subagent_type: ccsk:code-reviewer`. When we
 * MATERIALIZE agents/skills into a project (no plugin), those references must be
 * rewritten or delegation breaks:
 *   - Skills become slash-commands named after their (prefixed) dir → `/ccsk-plan`.
 *   - Agents become project subagents keyed by their bare name → `code-reviewer`.
 *
 * All replacements are anchored on the KNOWN roster names, so stray `ccsk:` in
 * prose/URLs is never touched.
 */

/** Escapes a string for literal use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param text   file contents to rewrite
 * @param roster known skill + agent names (from the kit being materialized)
 * @returns the text with `ccsk:` namespace references normalized for a
 *          plugin-less project
 */
export function rewriteCcskNamespace(
  text: string,
  roster: { skills: string[]; agents: string[] },
): string {
  let out = text;

  // 1. Skill slash-commands: `/ccsk:plan` → `/ccsk-plan` (dir is renamed to match).
  //    Order skills longest-first so `code-review` is tried before any prefix of it.
  //    `(?![\w-])` (not `\b`) so a trailing hyphen also blocks — otherwise skill
  //    `journal` would corrupt a hypothetical `/ccsk:journal-writer`.
  for (const skill of [...roster.skills].sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`/ccsk:${escapeRegExp(skill)}(?![\\w-])`, 'g'),
      `/ccsk-${skill}`,
    );
  }

  // 2. Agent delegation refs: `ccsk:code-reviewer` → `code-reviewer` (bare name).
  //    `(?<![\\w/-])` avoids matching inside an already-rewritten `/ccsk-…` token
  //    or a longer identifier. Longest-first for the same prefix reason.
  for (const agent of [...roster.agents].sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`(?<![\\w/-])ccsk:${escapeRegExp(agent)}\\b`, 'g'),
      agent,
    );
  }

  // 3. Any remaining BARE skill ref `ccsk:build` (no leading slash) → `ccsk-build`,
  //    so a prose command mention still points at the materialized dir name.
  for (const skill of [...roster.skills].sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`(?<![\\w/-])ccsk:${escapeRegExp(skill)}(?![\\w-])`, 'g'),
      `ccsk-${skill}`,
    );
  }

  return out;
}
