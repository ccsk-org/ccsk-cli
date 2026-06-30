<div align="center">

# @ccsk/cli

**Scaffold a Claude-ready project in one command.**

`ccsk init`

[![npm version](https://img.shields.io/npm/v/@ccsk/cli.svg?color=D97757)](https://www.npmjs.com/package/@ccsk/cli)
[![downloads](https://img.shields.io/npm/dm/@ccsk/cli.svg?color=3F9B6B)](https://www.npmjs.com/package/@ccsk/cli)
[![node](https://img.shields.io/node/v/@ccsk/cli.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@ccsk/cli.svg?color=1A1A1A)](#license)
[![platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-6B7280.svg)](#)

> Stop hand-rolling `CLAUDE.md`, agent definitions, and docs for every repo. One command drops a complete [**ccsk-kit**](https://github.com/ccsk-org/ccsk-kit) Claude Code harness — workflows, multi-agent orchestration, slash commands, and skills — into your project.

</div>

---

## Highlights

- 🚀 **One command to productive** — `ccsk init` and your repo is Claude-ready.
- 📦 **Fetches & caches the kit** — shallow-clones the official kit and caches it at `~/.ccsk/kit/<version>` for fast re-installs.
- 🧩 **Dotfile-safe mapping** — ships `_dot_claude → .claude`, `_dot_ccsk → .ccsk`, `_dot_mcp → .mcp.json`.
- 🔐 **Auth-aware** — detects SSH / `gh` CLI and guides you if access is missing.
- 🩺 **`doctor` & `uninstall`** — diagnose a broken setup or cleanly remove everything.
- 🎨 **Optional extras** — ADD methodology, design references (70+ systems), and tooling setup, all skippable.
- 💻 **Cross-platform & CI-friendly** — macOS / Linux / Windows; `-y` for non-interactive runs.

---

## Quick start

> A global CLI tool, not a project dependency. Requires **Node ≥ 20**.

```bash
npm i -g @ccsk/cli
# or: pnpm add -g @ccsk/cli · yarn global add @ccsk/cli · bun add -g @ccsk/cli

ccsk auth          # verify GitHub access (kit repo is private)
ccsk init          # scaffold the kit into the current directory
claude             # open Claude Code
/scaffold <intent> # generate stack docs, architecture, and a phased plan
```

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/terminal-init.svg" alt="ccsk init terminal walkthrough" width="780">
</div>

---

## How it works

`ccsk init` is auth-aware, cached, and idempotent — it overwrites only the files it ships and never touches your code.

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/install-flow.svg" alt="ccsk init pipeline: confirm, auth, fetch, copy, setup, ready" width="900">
</div>

And here's what lands in your project:

<div align="center">
<img src="https://raw.githubusercontent.com/ccsk-org/ccsk-cli/main/.github/assets/whats-installed.svg" alt="Before and after: a bare project versus a ccsk-equipped one" width="860">
</div>

The installed kit runs on the **Build Cadence** — `Frame → Forge → Prove → Sign-off` — with the `/ccsk-plan`, `/ccsk-build`, and `/ccsk-loop` commands. See the [**ccsk-kit**](https://github.com/ccsk-org/ccsk-kit) repo for the full method.

---

## Command reference

| Command | What it does | Key flags |
|---|---|---|
| `ccsk init [path]` | Install the kit into a project | `--version <v>` · `--force` · `--no-setup` · `--no-add` · `-y, --yes` |
| `ccsk auth` | Check GitHub auth (kit repo is private) | — |
| `ccsk doctor` | Diagnose the install & environment | — |
| `ccsk design [path]` | Add a `DESIGN.md` reference (70+ design systems) | — |
| `ccsk cache` | Manage cached kit versions | `-l, --list` · `--clear` · `--clear-all` · `--version <v>` |
| `ccsk update [version]` | Upgrade the CLI globally (auto-detects pkg manager) | — |
| `ccsk uninstall [path]` | Remove the kit from a project | `-y, --yes` |
| `ccsk donate` | Support the maintainer via VietQR | — |

Global: `-h, --help` · `-v, --version`. Env: `CCSK_DEBUG=1` (stack traces) · `CI=1` (disable prompts).

```bash
ccsk init --version v1.2.0 --no-add -y   # pin a kit version, skip ADD, non-interactive
ccsk design                              # browse design systems and add a reference
ccsk doctor                              # check Node, git, GitHub auth, cache
```

---

## Works with ADD

[**ADD (AI-Driven Development)**](https://github.com/pilotspace/ADD) is a methodology where AI writes the code while humans own direction and verification — **Specify → Scenarios → Contract → Tests → Build → Verify**. `ccsk init` can install it for you (skip with `--no-add`):

- **ccsk** scaffolds Claude Code's rules, agents, commands, and skills.
- **ADD** adds the specification-first, test-driven loop on top.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `command not found: ccsk` | Add your global bin to PATH. npm: `$(npm prefix -g)/bin`. bun: `~/.bun/bin`. |
| `Permission denied (publickey)` | Run `ccsk auth` and follow the setup steps. |
| `GitHub authentication required` | Set up SSH keys or install `gh` CLI and run `gh auth login`. |
| Spinner shows raw text | Expected in CI or when piped — animations degrade gracefully. |
| Something else is off | Run `ccsk doctor` for a full diagnosis, or `CCSK_DEBUG=1 ccsk <cmd>` for stack traces. |

---

## Contributing

Contributions welcome — open an issue first for anything beyond small fixes.

- **Conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Cross-platform**: test on macOS / Linux / Windows when possible.
- **Keep it tight**: no new global tooling without discussion.

See [docs/architecture.md](./docs/architecture.md) for module-level details.

---

## Support the project

If ccsk saves you time, consider supporting development:

```bash
ccsk donate    # buy the maintainer a coffee via VietQR
```

---

## Links & license

- Kit → [**ccsk-kit**](https://github.com/ccsk-org/ccsk-kit) · Issues → [ccsk-cli/issues](https://github.com/ccsk-org/ccsk-cli/issues) · Discussions → [ccsk-cli/discussions](https://github.com/ccsk-org/ccsk-cli/discussions)
- License → **MIT** (see [LICENSE](./LICENSE))
