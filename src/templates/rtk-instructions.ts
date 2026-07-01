/**
 * Project-level RTK usage rule, materialized by `wireRtkInstructions` into
 * `.claude/rules/rtk-instructions.md` and referenced by a single contract-style
 * `@`-import in the project CLAUDE.md.
 *
 * This exists so RTK guidance lives in its OWN rule file (like the always-on
 * contract rules) instead of being dumped into CLAUDE.md by the external
 * `rtk init` binary — keeping CLAUDE.md clean. Shipped as a TS string so `tsc`
 * carries it into `dist/` without an asset-copy step.
 */
export const RTK_INSTRUCTIONS_MARKDOWN = `# RTK — Rust Token Killer

Token-optimized CLI proxy that rewrites dev commands to save tokens (typically
60–90% on common dev operations). Wired into this project by \`ccsk init\`.

## Meta commands (run \`rtk\` directly)

\`\`\`bash
rtk gain              # show token-savings analytics
rtk gain --history    # command usage history with savings
rtk discover          # analyze Claude Code history for missed opportunities
rtk proxy <cmd>       # run a raw command without filtering (debugging)
\`\`\`

## Hook-based usage

All other commands are rewritten automatically by the Claude Code hook that
\`rtk init\` installed for this project — e.g. \`git status\` runs as
\`rtk git status\` transparently, with no token overhead. You do not need to
prefix commands yourself.

## Verify the install

\`\`\`bash
rtk --version         # should print: rtk X.Y.Z
rtk gain              # should work (not "command not found")
which rtk             # confirm the expected binary is on PATH
\`\`\`

> Name collision: if \`rtk gain\` errors, a different \`rtk\` binary may be on
> PATH. Check \`which rtk\` and reinstall from the RTK release if needed.
`;
