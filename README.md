# @ccsk/cli

[![npm version](https://img.shields.io/npm/v/@ccsk/cli.svg)](https://www.npmjs.com/package/@ccsk/cli)
[![license](https://img.shields.io/npm/l/@ccsk/cli.svg)](#license)
[![node](https://img.shields.io/node/v/@ccsk/cli.svg)](https://nodejs.org)
[![platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg)](#cross-platform-support)

> **Claude Code Starter Kit** — provision a fully-configured Claude Code workspace into any project with one command.

`ccsk` is a single-binary CLI that pulls versioned, curated "kits" (CLAUDE.md, `.claude/` rules and agents, MCP scaffolding, documentation skeletons) from private GitHub repositories into the directory of your choice. License gating, GitHub auth detection, kit caching, payment flow, and a Claude-Code slash command for bootstrapping the project are built in.

This README is the official user documentation. For architecture details see [`docs/architecture.md`](./docs/architecture.md).

---

## Table of contents

1. [What is ccsk?](#what-is-ccsk)
2. [Quick start](#quick-start)
3. [Install](#install)
4. [Concepts](#concepts)
5. [Command reference](#command-reference)
6. [Available kits](#available-kits)
7. [License model](#license-model)
8. [Payment flow](#payment-flow-paid-kits)
9. [GitHub authentication](#github-authentication)
10. [Offline & cache](#offline--cache)
11. [Cross-platform support](#cross-platform-support)
12. [Storage paths](#storage-paths)
13. [Troubleshooting](#troubleshooting)
14. [Local development](#local-development)
15. [Architecture (one paragraph)](#architecture-one-paragraph)
16. [Contributors](#contributors)
17. [Contributing](#contributing)
18. [Support](#support)
19. [License](#license)

---

## What is ccsk?

`ccsk` solves the *cold-start* problem for a Claude Code project. Instead of hand-rolling `CLAUDE.md`, agent definitions, rules, and documentation skeletons every time, `ccsk init` lays down a vetted starter pack — a **kit** — and exits cleanly. From the kit, `/ccsk:bootstrap` (a slash command shipped *inside* the kit) interviews you, resolves current stack versions, and produces tech-stack docs, architecture, and a multi-phase implementation plan tailored to your project.

A kit contains:

- `CLAUDE.md` — the project-level instruction file Claude Code reads first.
- `.claude/rules/` — non-negotiable workflow rules (development, documentation, technical-stacks template).
- `.claude/agents/` — sub-agent definitions (code-reviewer, debugger, etc.).
- `.claude/commands/` — slash commands, including `bootstrap` (canonical name `ccsk:bootstrap`).
- `docs/` — documentation skeleton (code standards, architecture, PDR, roadmap).
- `.mcp.json` + `.ccsk/` — MCP server config and per-project ccsk metadata.

---

## Quick start

```bash
# 1. Install globally (any package manager)
npm i -g @ccsk/cli

# 2. Verify GitHub auth (kits live in private repos)
ccsk auth

# 3. Lay the free Common kit into the current directory
ccsk init

# 4. Open the project in Claude Code
claude

# 5. Bootstrap your stack, architecture, and plan
/bootstrap B2B HR SaaS for VN SMEs   # canonical name: ccsk:bootstrap
```

That's the 60-second path. The free `common` kit auto-registers a license on first run; paid kits go through the in-CLI VietQR purchase flow.

---

## Install

`ccsk` is published to npm as a globally-installable binary. Node ≥ 20 is required.

| Package manager | Install | Update | Uninstall |
| --- | --- | --- | --- |
| **npm** | `npm i -g @ccsk/cli` | `npm i -g @ccsk/cli@latest` | `npm uninstall -g @ccsk/cli` |
| **pnpm** | `pnpm add -g @ccsk/cli` | `pnpm update -g @ccsk/cli` | `pnpm remove -g @ccsk/cli` |
| **yarn** (1.x) | `yarn global add @ccsk/cli` | `yarn global upgrade @ccsk/cli` | `yarn global remove @ccsk/cli` |
| **bun** | `bun add -g @ccsk/cli` | `bun add -g @ccsk/cli@latest` | `bun remove -g @ccsk/cli` |

After install, `ccsk --version` should print the installed version. If it doesn't, your global bin directory is not on `PATH` — see [Troubleshooting](#troubleshooting).

---

## Concepts

### Kit
A versioned, opinionated bundle (CLAUDE.md, `.claude/`, `docs/`, MCP config). One kit installs at a time. Free or paid. Pulled via `git clone --depth 1 --branch v<X>` from a private GitHub repo under [ccsk-org](https://github.com/ccsk-org).

### License
A `CCSK-XXXX-XXXX-XXXX` key stored at `~/.ccsk/license`. Free keys are auto-registered on first run. Paid keys are bound to a single GitHub identity for piracy resistance.

### GitHub auth
Required to clone kit repos. `ccsk auth` detects SSH (`ssh -T git@github.com`) and `gh` CLI (`gh auth status`) and reports which method is active. Either is sufficient.

### Cache
Downloaded kits live under `~/.ccsk/kits/<kit>/<version>/`. `ccsk init` uses the cache automatically. `--force` re-clones; `ccsk cache --clear` purges.

### Bootstrap (slash command)
Shipped inside every kit at `.claude/commands/bootstrap.md` (canonical name `ccsk:bootstrap`). After `ccsk init`, open Claude Code and run `/bootstrap <intent>` — it interviews you, verifies current stack versions via `context7`/`docs-seeker`, and writes `docs/`, `CLAUDE.md` updates (surgically), and a phased `plans/` directory.

---

## Command reference

### `ccsk init [path]`

Lay a kit into a project directory.

| Flag | Effect |
| --- | --- |
| `--kit <id>` | Skip the picker. Values: `common`, `frontend`, `backend`, `mobile`. |
| `--version <semver>` | Pin to a specific kit version. Default: latest release resolved at install time (`gh api releases/latest`, falling back to `git ls-remote --tags`). |
| `--force` | Re-clone even if cached. |
| `--no-setup` | Skip RTK-AI / context-mode / Serena MCP install step. |
| `-y, --yes` | Auto-confirm every prompt. CI-safe. |

On success, prints:
```
Next:
  cd <path>
  claude                       # open Claude Code in this project
  /bootstrap <one-line>        # canonical name: ccsk:bootstrap → tech-stacks, architecture, docs, plan
```

### `ccsk auth`

Diagnoses GitHub auth. Tries SSH first, falls back to `gh`. Prints exact remediation commands if neither works. No flags.

### `ccsk cache`

Manage `~/.ccsk/kits/`.

```bash
ccsk cache --list                          # show cached kits
ccsk cache --kit frontend                  # pre-download for offline use
ccsk cache --kit frontend --version 1.0.0  # pin version while pre-downloading
ccsk cache --clear --kit frontend          # purge one kit
ccsk cache --clear-all                     # purge everything
```

### `ccsk update [version]`

Self-update the CLI. Auto-detects the package manager that owns the global install (see [`ccsk uninstall`](#ccsk-uninstall-path) for the same detection logic).

```bash
ccsk update              # install @ccsk/cli@latest
ccsk update latest       # same as above
ccsk update 1.0.2        # pin to a specific version
ccsk update next         # any npm dist-tag
```

On failure (permissions, network), the exact manual command for your detected PM is printed.

### `ccsk uninstall [path]`

Two-stage cleanup, both stages confirmed independently:

1. **Project files.** Remove `CLAUDE.md`, `.claude/`, `.mcp.json`, kit-added docs from `<path>`. Application code is never touched.
2. **Global CLI.** Detects which PM owns `@ccsk/cli` (probes `npm/pnpm/yarn/bun ls -g`), runs that PM's `remove -g`, verifies by re-checking `ccsk` on PATH. Falls back to trying every supported PM if detection is inconclusive.
3. **Local state (optional).** Offers to delete `~/.ccsk` (license + cache). Off by default in `-y` mode so reinstalls don't lose your license.

| Flag | Effect |
| --- | --- |
| `-y, --yes` | Auto-confirm file removal, but never auto-wipe license/cache. |

---

## Available kits

| Kit | Status | What you get |
| --- | --- | --- |
| `common` | ✅ Stable · Free | Base Claude Code config: rules, agents, slash commands (`bootstrap` aka `ccsk:bootstrap`, `ultra-think`, `update-docs`), MCP scaffold, docs skeleton. Always free. |
| `frontend` | ✅ Stable · Paid | Same baseline as common, with frontend-flavoured rules and agents. Future updates ship here first. |
| `backend` | 🟡 Coming soon · Paid | Server-side workflows (Node / Python / Go). Same price as frontend on release. |
| `mobile` | 🟡 Coming soon · Paid | Mobile workflows (React Native / Flutter / SwiftUI). Same price as frontend on release. |

Lifetime price is fetched at run time from Supabase `app_settings` so the operator can re-price without a CLI release.

---

## License model

### Free tier (`common` kit)
First run auto-registers a free key (`CCSK-XXXX-XXXX-XXXX`), saves it to `~/.ccsk/license`, and unlocks the `common` kit. No payment, no email, no GitHub identity needed.

### Paid tier (other kits)
When you select a paid kit without a valid license, `ccsk` shows a 3-option menu:

```
Frontend Workflows Kit requires a license.
❯ Already have a license. Enter key
  Purchase a license (265,000 VND - lifetime)
  Back
```

| Choice | What happens |
| --- | --- |
| **Already have a license** | You paste the key. `ccsk` validates it against Supabase, binds it to your GitHub identity if first-use, and saves to `~/.ccsk/license`. |
| **Purchase a license** | Triggers the [Payment flow](#payment-flow-paid-kits). |
| **Back** | Returns to the kit picker. |

### Per-account binding (paid kits)
Paid licenses are bound to a single GitHub account on first successful validation. The GitHub identity is read automatically via `gh api user` or `ssh -T git@github.com` — no extra prompt.

| Situation | Result |
| --- | --- |
| Same GitHub user, any number of machines | ✅ Works. |
| Different GitHub user, same key (leaked) | ❌ `This license is bound to @other-user`. |
| No GitHub auth | ❌ Paid kits refuse to install. Run `ccsk auth`. |

Free `common` keys are unbound and shareable — they unlock nothing paid.

---

## Payment flow (paid kits)

The whole flow runs in your terminal:

1. **Email prompt** — where the license key should be delivered.
2. **Transaction reservation** — Supabase mints a 6-digit transaction ID and stores a `pending_licenses` row tagged with your email + GitHub username.
3. **Side-by-side VietQR codes** — one QR per enabled bank rendered directly in your terminal (Momo + Techcombank by default). The QR payload is the **EMVCo VietQR string** (built locally with `vietnam-qr-pay`), so Vietnamese banking apps can scan it and pre-fill the transfer.
4. **Transfer memo** is pre-filled: `CCSK TT KIT FE 482917`. Keep the 6-digit ID for follow-up if you need to contact support.
5. **CLI exits cleanly** — no polling. Once the operator confirms your transfer, the license key is emailed to you. Re-run `ccsk init` and pick **Already have a license. Enter key**.

> **Why manual issuance?** Bank reconciliation is operator-driven for now. The CLI never sees your transfer, only reserves a transaction ID for matching.

The kit picker price and the bank list are both loaded from Supabase `app_settings` so the operator can re-price or rotate banks without a CLI release.

---

## GitHub authentication

Kits live in private repos under [ccsk-org](https://github.com/ccsk-org). You need **one** of:

| Method | Setup | Recommended for |
| --- | --- | --- |
| SSH (key-based) | `ssh-keygen -t ed25519` → add to https://github.com/settings/keys | Long-term, multi-repo |
| `gh` CLI | `brew install gh && gh auth login` (or platform equivalent) | Quick setup, fresh machines |

`ccsk auth` reports which is active. For paid kits, the GitHub identity also drives license binding (see [License model](#license-model)).

---

## Offline & cache

Pre-fetch kits while connected:

```bash
ccsk cache --kit common --version 1.0.0
ccsk cache --kit frontend --version 1.0.0
```

Cached at `~/.ccsk/kits/<kit>/<version>/`. `ccsk init` reads the cache automatically; pass `--force` to re-clone.

License validation still requires a one-time online round trip per kit/version combination. Once validated, you're good offline.

---

## Cross-platform support

Tested and supported on macOS, Linux, and Windows 10/11.

| Concern | Behaviour |
| --- | --- |
| Path resolution | All paths go through `path.join` + `os.homedir()`. No hard-coded separators. |
| PATH lookup for git / claude / package managers | Uses `where` on Windows, `which` elsewhere — no shell invocation. |
| Shell injection | `execa` is invoked with array args everywhere. Package names and paths are constants. |
| Terminal animations (shimmer spinner, QR render) | Gated on `process.stdout.isTTY`. Degrade to plain `→ step` lines under `NO_COLOR`, `CI`, or when piped. |
| Recursive directory removal | `fs.rmSync(..., { recursive: true, force: true })`. No `rm -rf` shellouts. |
| `~/.ccsk` wipe on uninstall | Only ever scoped to `path.join(os.homedir(), '.ccsk')`, behind a confirm prompt. |

If you hit a platform-specific bug, please file an issue with `ccsk --version`, `node --version`, and `process.platform` so we can reproduce.

---

## Storage paths

| Path | Owner | Contents |
| --- | --- | --- |
| `~/.ccsk/license` | `core/license.ts` | Single line. The activated CCSK key. |
| `~/.ccsk/kits/<kit>/<version>/` | `core/kit-cache.ts` | Shallow-cloned kit contents. Safe to delete. |

Per-project state (after `ccsk init`):

```
your-project/
├── CLAUDE.md             # primary Claude instructions
├── .claude/              # agents, rules, slash commands, settings
├── .ccsk/                # per-project ccsk metadata
├── .mcp.json             # MCP server configuration
└── docs/                 # documentation skeleton
```

> `_dot_X` directories in kit repos are renamed to `.X` on copy. (npm strips literal dotfiles from packed tarballs; this is the workaround.)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `command not found: ccsk` after install | Global bin dir not on PATH | npm: add `$(npm prefix -g)/bin` to PATH. bun: add `~/.bun/bin`. pnpm: `pnpm setup`. |
| `Could not register free license. HTTP 404` | Supabase Edge Functions not deployed | Operator: deploy `register-free-license`. |
| `This license is bound to @other-user` | Key already bound to another GitHub identity | Switch GitHub account or contact support. |
| `GitHub authentication required` on paid kit | Neither SSH nor `gh` is set up | Run `ccsk auth` and follow the printed steps. |
| Kit clone fails with `Permission denied (publickey)` | GitHub auth missing for kit-repo access | Same — `ccsk auth`. |
| Bank app can't read the terminal QR | Terminal width or font issue | The printed `vietqr.io` URL below the QR is the fallback — open it on your phone. |
| `ccsk uninstall` couldn't remove the CLI | Detected PM failed silently | Run the manual command for your PM (the list is printed). |
| Spinner shows raw text or no animation | Not a TTY, or `NO_COLOR`/`CI` set | Expected — the spinner intentionally degrades for logs and pipes. |

---

## Local development

```bash
git clone git@github.com:imnortheastt/ccsk-cli.git
cd ccsk-cli

npm install        # or: pnpm install / bun install
npm run build      # compile TS → dist/
npm link           # expose `ccsk` from your working tree

ccsk --version
```

Source in `src/`, compiled to `dist/`. Supabase migrations + Edge Functions live under `supabase/` (separate from the CLI publish path). Run `npm run build` (or `tsc`) before testing changes; the published `dist/` is the source of truth at install time.

---

## Architecture (one paragraph)

A thin Node CLI (`commander` + `@clack/prompts`) reads kit metadata from a static registry, calls Supabase Edge Functions for license validation and payment reservation, falls back to embedded defaults when offline, clones the matching private repo with the user's existing GitHub credentials, and copies the result into the target directory with a small set of name transforms. The `bootstrap` slash command (canonical name `ccsk:bootstrap`) lives inside each kit (not in the CLI) so it stays versioned with kit conventions. See [`docs/architecture.md`](./docs/architecture.md) for module-level detail.

---

## Contributors

| Role | Name | Profile |
| --- | --- | --- |
| **Author · Architect · Core Contributor** | Crystal D. | [@imnortheastt](https://github.com/imnortheastt) |
| Contributor | E. Wallis | [@ewalliss](https://github.com/ewalliss) |

---

## Contributing

We welcome focused contributions.

- **Open an issue first** for anything beyond a small fix so we can align on design before code lands.
- **Conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). No AI signatures in commit messages or PR descriptions.
- **No new global tooling** without prior discussion — keep the install footprint tight.
- **Cross-platform** — if you can't test on Windows, say so in the PR. We'll cover.

---

## Support

- **Issues:** https://github.com/imnortheastt/ccsk-cli/issues
- **Discussions:** https://github.com/imnortheastt/ccsk-cli/discussions
- **Contact:** duongdong2203@gmail.com

---

## License

MIT © Crystal D. and contributors. See [LICENSE](./LICENSE).
