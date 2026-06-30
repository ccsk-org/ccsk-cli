# `@ccsk/cli` — Architecture

A concise map of the CLI as it ships today. Aimed at contributors and reviewers.

## Module layout

```
src/
├── cli.ts                    # commander entry; wires sub-commands + guard() wrapper
├── commands/
│   ├── init.ts               # main flow: confirm → auth → fetch → copy → add → setup → design
│   ├── auth.ts               # `ccsk auth` → GitHub auth status
│   ├── cache.ts              # list/clear ~/.ccsk/kit
│   ├── design.ts             # `ccsk design` → add a design reference (npx getdesign)
│   ├── doctor.ts             # `ccsk doctor` → 5-point diagnostics
│   ├── donate.ts             # `ccsk donate` → VietQR donation flow
│   ├── uninstall.ts          # kit files + optional global CLI + optional tools wipe
│   └── update.ts             # `ccsk update` → self-update via the detected PM
├── core/
│   ├── kit-fetcher.ts        # `git clone --depth 1 v<ver>` into ~/.ccsk/kit
│   ├── kit-cache.ts          # cache path resolution + presence check
│   ├── copy-kit.ts           # cache → target project copy (_dot_X → .X)
│   ├── remove-kit.ts         # inverse of copy-kit (used by `ccsk uninstall`)
│   ├── install-tracker.ts    # anonymous install POST to Supabase (fire-and-forget)
│   ├── donation.ts           # donation flow: tier picker, email, render, record
│   ├── donation-qr.ts        # pure VietQR payload/URL builders + side-by-side layout
│   ├── payment-config.ts     # Supabase `get-payment-config` (banks + VND price)
│   ├── design-catalog.ts     # design reference catalogue (categories)
│   ├── add.ts                # `npx @pilotspace/add init` wrapper
│   ├── context-mode.ts       # register context-mode MCP via `claude mcp add`
│   ├── gh-cli.ts             # multi-platform `gh` CLI installer
│   ├── rtk.ts                # optional RTK install (fetch install.sh → sh)
│   ├── pkg-manager.ts        # detect global owner of @ccsk/cli, run remove cross-PM
│   ├── github-auth.ts        # `gh` / SSH detection for the private kit repo
│   ├── self-update.ts        # `npm/pnpm/yarn/bun install -g @ccsk/cli@<ver>`; min-version floor
│   ├── setup-runner.ts       # optional post-install tool setup (gh, RTK, context-mode)
│   ├── doctor.ts             # diagnostics with injectable probes (the tested module)
│   └── step-result.ts        # { name, status: 'ok'|'skipped'|'failed', detail? }
└── util/
    ├── banner.ts             # pixel-block "ccsk" gradient wordmark
    ├── log.ts                # picocolors-based log helpers
    ├── platform.ts           # OS detection, homeDir(), binExists() (uses `where`/`which`)
    ├── qr-terminal.ts        # half-block QR renderer (1×2 modules/char → square output)
    ├── category-accordion-prompt.ts   # interactive picker (state machine)
    ├── category-accordion-render.ts   # pure row/frame rendering for the picker
    ├── progress.ts           # line-based percentage progress
    ├── gitignore-sync.ts     # create/merge/replace the ccsk-managed .gitignore block
    └── shimmer-spinner.ts    # braille spinner + lavender→teal shimmer + elapsed timer
```

## `ccsk init` data flow

1. **Banner** (`util/banner.ts`) — gradient wordmark, version, capability rail.
2. **Confirm** (`commands/init.ts`) — `@clack/prompts` confirm unless `--yes`.
3. **GitHub auth** (`core/github-auth.ts`) — prefers SSH (`ssh -T git@github.com`); falls back to the `gh` token. Errors out if neither is available (the kit repo is private).
4. **Fetch kit** (`core/kit-fetcher.ts`) — resolve latest tag, `git clone --depth 1 --branch v<X>` into `~/.ccsk/kit/<version>`. Shallow + `.git` stripped after success.
5. **Register install** (`core/install-tracker.ts`) — silently detect the GitHub user, optionally prompt for email, fire-and-forget POST to Supabase `register-install`.
6. **Copy** (`core/copy-kit.ts`) — copy from cache into target with a **non-destructive, per-file backup** policy: when a target file already exists the user picks Overwrite (back up theirs to `<name>.<ext>.bak`, then write the ccsk version), Keep mine (leave theirs, write the ccsk version alongside as `<name>.<ext>.ccsk.bak`), or Cancel; `--yes`/`--force`/CI default to Overwrite-with-backup. `_dot_X` path segments map to `.X` (e.g. `_dot_claude/commands/scaffold.md` → `.claude/commands/scaffold.md`); excludes `settings.local.json`, `.DS_Store`, root `todo/`; `.ccsk/` memory is always preserved.
7. **Sync .gitignore** (`util/gitignore-sync.ts`) — create/merge/replace the ccsk-managed ignore block in the target.
8. **Optional ADD** (`core/add.ts`) — if `--add`, run `npx @pilotspace/add init` in the target.
9. **Optional setup** (`core/setup-runner.ts`) — if `--setup`, install `gh` CLI, RTK, and the context-mode MCP.
10. **Design reference** (`commands/design.ts → runDesignSetup`) — interactive picker; skipped under `--yes` / non-TTY.
11. **Next steps + donate** (`commands/init.ts`) — prints `cd`, `claude`, the `/scaffold <intent>` guide, then optionally prompts a donation (`core/donation.ts`).

## `ccsk uninstall` data flow

1. Confirm + remove kit files from the target project (`core/remove-kit.ts`).
2. Optionally remove the globally-shared MCP tools (Serena, context-mode, RTK).
3. Optionally remove `@ccsk/cli` itself:
   - `pkg-manager.detectCcskOwner()` probes each PM's `ls -g`/`global list` and string-matches `@ccsk/cli`.
   - `removeCcskGlobally()` calls the detected owner's `remove -g`, verifies by re-checking `ccsk` on PATH; if uninstall failed it walks every PM in order.
   - Prints the owning PM (`Uninstalled @ccsk/cli via pnpm`) or, on total failure, a manual fallback list for npm/pnpm/yarn/bun.
4. Optionally wipe `~/.ccsk` (kit cache). Off by default in `--yes` mode.

## State on disk

| Path | Owner | Contents |
| --- | --- | --- |
| `~/.ccsk/kit/<version>/` | `core/kit-cache.ts` | Shallow-cloned kit contents. Safe to delete. |

## Remote dependencies

| Surface | Endpoint | Owner |
| --- | --- | --- |
| Register install | `POST /functions/v1/register-install` | `core/install-tracker.ts` |
| Payment config | `GET /functions/v1/get-payment-config` | `core/payment-config.ts` |
| Record donation | `POST /functions/v1/record-donation` | `core/donation.ts` |
| Kit clone | `git clone` of `github.com/ccsk-org/ccsk-kit` (private) | `core/kit-fetcher.ts` |
| QR image fallback | `https://api.vietqr.io/image/...` | `core/donation.ts` |
| RTK install (opt-in) | `raw.githubusercontent.com/rtk-ai/rtk/.../install.sh` | `core/rtk.ts` |

All Supabase calls authenticate with the publishable anon key. There are no secrets in this client.

## Cross-platform contract

- File-system paths always go through `path.join` + `util/platform.homeDir()`.
- PATH lookups use `binExists()` → `where` on Windows, `which` elsewhere — no shell invocation.
- `execa` is invoked with array args throughout; nothing is interpolated through a shell.
- Terminal animations (shimmer spinner, cursor hide) are gated on `process.stdout.isTTY` and degrade to a static `log.step` line under `NO_COLOR` / CI / pipes.
- `fs.rmSync(..., { recursive: true, force: true })` is used for the optional `~/.ccsk` wipe — portable, no `rm -rf`.

## Security checklist

- Only the publishable Supabase anon key is embedded; service-role keys live in Edge Functions.
- All external commands are spawned with array args (no `shell: true`, no string interpolation into a shell).
- Network calls have explicit timeouts (`pkg-manager.ts`, kit clone) so a hung registry cannot freeze the CLI.
- Destructive filesystem operations (`rmSync`) are scoped to known directories under `homeDir()` and gated behind a confirm prompt.
- License-bearing requests never log the key. The CLI prints `key saved` / `license valid`, never the key value.
- VietQR payloads are built locally and validated before render; the printed vietqr.io image URL is shown only as a manual fallback link, not auto-fetched.

## Testing the flows end-to-end

```bash
# Lint + types
npm run build

# Init smoke test (interactive)
node dist/cli.js init ./tmp-proj

# Uninstall smoke test (after a global install)
npm i -g @ccsk/cli && ccsk uninstall

# QR payload sanity check
node -e "const {QRPay}=require('vietnam-qr-pay');\
  const q=QRPay.initVietQR({bankBin:'970407',bankNumber:'19034526108011'});\
  q.amount='265000'; q.additionalData.purpose='CCSK TT KIT FE 123456';\
  console.log(q.build());"
```
