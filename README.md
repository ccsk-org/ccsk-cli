<div align="center">

# @ccsk/cli

**Install a complete Claude Code kit — and pick the version — in one command.**

`ccsk init`

[![npm version](https://img.shields.io/npm/v/@ccsk/cli.svg?color=D97757)](https://www.npmjs.com/package/@ccsk/cli)
[![downloads](https://img.shields.io/npm/dm/@ccsk/cli.svg?color=3F9B6B)](https://www.npmjs.com/package/@ccsk/cli)
[![node](https://img.shields.io/node/v/@ccsk/cli.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@ccsk/cli.svg?color=1A1A1A)](#license)
[![platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-6B7280.svg)](#)

> Stop hand-rolling `CLAUDE.md`, agents, rules, and docs for every repo. `ccsk init` installs the [**ccsk-kit**](https://github.com/ccsk-org/ccsk-kit) Claude Code harness as a **plugin** and materializes its contract into your project — with a **version picker** so you choose the stable kit or opt into a beta.

</div>

---

## Highlights

- 🚀 **One command to productive** — `ccsk init` and your repo is Claude-ready.
- 🎚️ **Pick your kit version** — an interactive picker lists available versions; stable by default, prereleases opt-in (`--pre` / `--version`). Discover with `ccsk versions`.
- 🧩 **Plugin + materialized contract** — installs the `ccsk@ccsk-kit` Claude Code plugin (the `/ccsk:` commands, agents, skills) and copies `CLAUDE.md`, `.claude/rules`, `docs/`, and `.ccsk/` into your project.
- 📦 **Fetches & caches** — shallow-clones the kit and caches it at `~/.ccsk/kit/<version>` for fast re-installs.
- 🔐 **Auth-aware** — detects SSH / `gh` CLI and guides you if access is missing (the kit repo is private).
- 🧠 **Memory-safe** — re-install and `update` never clobber your `.ccsk/` memory; `uninstall` preserves it by default (and backs it up before any purge).
- 🎨 **Optional extras** — tool setup (gh · RTK · context-mode · Serena MCP), ADD methodology, and design references — all skippable.
- 💻 **Cross-platform & CI-friendly** — macOS / Linux / Windows; `-y` for non-interactive runs.

---

## Quick start

> A global CLI tool, not a project dependency. Requires **Node ≥ 20**.

```bash
npm i -g @ccsk/cli
# or: pnpm add -g @ccsk/cli · yarn global add @ccsk/cli · bun add -g @ccsk/cli

ccsk auth          # verify GitHub access (kit repo is private)
ccsk versions      # see available kit versions (stable + beta)
ccsk init          # install — pick a version when prompted
claude             # open Claude Code
/ccsk:plan <goal>  # start the Build Cadence (v2 kit)
```

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/terminal-init.png" alt="ccsk init terminal walkthrough with the version picker" width="760">
</div>

---

## How it works

`ccsk init` is auth-aware, cached, and idempotent — it overwrites only the files it ships, **preserves your `.ccsk/` memory**, and never touches your code. It also writes a fenced block to your `.gitignore` (AI artifacts ignored by default) and installs a Claude Code plugin.

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/install-flow.png" alt="ccsk init pipeline: confirm, auth, version, fetch, materialize, plugin, ready" width="900">
</div>

Two things land — the **plugin** provides the `/ccsk:` commands, agents, and skills; the **contract** (`CLAUDE.md`, `.claude/rules`, `docs/`, `.ccsk/`) is materialized into your project (a plugin can't own project-root files):

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/whats-installed.png" alt="Before and after: a bare project versus a ccsk-equipped one" width="860">
</div>

See the [**ccsk-kit**](https://github.com/ccsk-org/ccsk-kit) repo for the Build Cadence (`Frame → Forge → Prove → Sign-off`) and the full method.

---

## Kit versions & channels

The CLI is version-aware: **stable by default, prereleases opt-in.** A plain `ccsk init` (or `--yes`/CI) installs the latest **stable** kit; you reach a beta only via the interactive picker, `--pre`, or an exact `--version`.

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/kit-channels.png" alt="Stable (default) vs beta (opt-in) kit channels" width="860">
</div>

```bash
ccsk versions                       # list available (remote) + cached + current
ccsk versions --all --pre           # include every prerelease
ccsk init                           # interactive: pick a version (default = latest stable)
ccsk init --pre                     # newest prerelease (e.g. the v2 beta)
ccsk init --version 2.0.0-beta-01   # an exact version (a leading v is fine too)
```

> **Heads-up (current state):** the v2 kit (`/ccsk:` colon commands) ships as the prerelease **`2.0.0-beta-01`**; the latest **stable** is **v1.1.0** (older `/ccsk-plan` hyphen commands). So a default `ccsk init` installs v1.1.0 — use `--pre` / `--version 2.0.0-beta-01` / the picker to get v2. A bare `ccsk update` never auto-downgrades: if you're on a newer beta it stays put.

---

## Command reference

| Command | What it does | Key flags |
|---|---|---|
| `ccsk init [path]` | Install the kit (picker + plugin + materialize) | `--version <v>` · `--pre` · `--force` · `--no-plugin` · `--plugin-scope <project\|user>` · `--no-setup` · `--no-add` · `-y, --yes` |
| `ccsk versions` | List available + cached + current kit versions | `--all` · `--pre` · `--json` |
| `ccsk auth` | Check GitHub auth (kit repo is private) | — |
| `ccsk update [version]` | Update **CLI + kit templates + plugin** together | `--path <dir>` · `--kit-version <v>` · `--pre` · `--plugin-scope <…>` · `--no-templates` · `--no-plugin` |
| `ccsk cache` | Manage cached kit versions (annotates current/(beta)/cached) | `-l, --list` · `--version <v>` · `--clear` · `--clear-all` |
| `ccsk uninstall [path]` | Remove the kit (preserves memory by default) | `--purge-memory` (backs up to `.ccsk.bak-<ts>/` first) · `-y, --yes` |
| `ccsk doctor` | Diagnose Node / git / auth / cache | — |
| `ccsk design [path]` | Add a `DESIGN.md` reference (70+ design systems) | — |
| `ccsk donate` | Support the maintainer via VietQR | — |

Global: `-h, --help` · `-v, --version`. Env: `CCSK_DEBUG=1` (stack traces) · `CI=1` (disable prompts).

```bash
ccsk init --version 1.2.0 --no-add -y   # pin a kit version, skip ADD, non-interactive
ccsk init --pre                          # opt into the newest prerelease kit
ccsk update --no-plugin                  # refresh CLI + templates, leave the plugin
ccsk uninstall --purge-memory            # remove everything (memory backed up first)
```

`update` is a three-layer, non-aborting operation: it self-updates the CLI, re-materializes the kit templates (preserving your memory), and runs `claude plugin update ccsk` — all pinned to one resolved version so the plugin and templates never drift.

---

## Tool setup

`ccsk init` offers an optional setup pass (skip with `--no-setup`) that wires, idempotently and without aborting on failure:

- **`gh` CLI** — installed if missing (for GitHub auth to the private kit repo).
- **RTK-AI** — installs `rtk` and runs `rtk init` to enable its Claude Code hook.
- **context-mode** — registers the `context-mode` MCP server (+ prints the manual plugin steps).
- **Serena** — registers the Serena MCP server (skipped if `uv`/`uvx` is absent).

The `ccsk` plugin itself is installed by `init` (skip with `--no-plugin`); if the `claude` CLI isn't found, init prints a hint and you can re-run later.

---

## Works with ADD

[**ADD (AI-Driven Development)**](https://github.com/pilotspace/ADD) is a methodology where AI writes the code while humans own direction and verification — **Specify → Scenarios → Contract → Tests → Build → Verify**. `ccsk init` can install it (`npx @pilotspace/add`; skip with `--no-add`):

- **ccsk** scaffolds Claude Code's plugin (commands/agents/skills) + rules, docs, and `.ccsk/` memory.
- **ADD** adds the specification-first, test-driven loop on top.

---

## Privacy

- `init` writes a fenced block to your project `.gitignore` that ignores AI artifacts (`.ccsk/`, loop logs, …) by default, with commented opt-in lines to commit the contract/memory for team sharing.
- `init` records the installed version locally (`~/.ccsk/install.json`) and sends **optional**, fire-and-forget install telemetry (GitHub username + an email you may decline). No code is ever read or uploaded.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `command not found: ccsk` | Add your global bin to PATH. npm: `$(npm prefix -g)/bin`. bun: `~/.bun/bin`. |
| `Permission denied (publickey)` / `GitHub authentication required` | Run `ccsk auth` and follow the steps (SSH keys, or `gh auth login`). |
| Plugin step skipped | The `claude` CLI wasn't found — install Claude Code, then re-run `ccsk init`. |
| `No stable kit release yet` in CI | A non-interactive run won't auto-pick a prerelease — pass `--version <v>` or `--pre`. |
| Spinner shows raw text | Expected in CI or when piped — animations degrade gracefully. |
| Something else is off | Run `ccsk doctor`, or `CCSK_DEBUG=1 ccsk <cmd>` for stack traces. |

---

## Contributing

Contributions welcome — open an issue first for anything beyond small fixes.

- **Conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Cross-platform**: test on macOS / Linux / Windows when possible.
- **Keep it tight**: no new global tooling without discussion.

See [docs/architecture.md](./docs/architecture.md) for module-level details and [RELEASING.md](./RELEASING.md) for the release flow.

---

## Support the project

```bash
ccsk donate    # buy the maintainer a coffee via VietQR
```

---

## Links & license

- Kit → [**ccsk-kit**](https://github.com/ccsk-org/ccsk-kit) · Issues → [ccsk-cli/issues](https://github.com/ccsk-org/ccsk-cli/issues) · Discussions → [ccsk-cli/discussions](https://github.com/ccsk-org/ccsk-cli/discussions)
- License → **MIT** (see [LICENSE](./LICENSE))
