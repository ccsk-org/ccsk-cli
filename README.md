# @ccsk/cli

[![npm version](https://img.shields.io/npm/v/@ccsk/cli.svg)](https://www.npmjs.com/package/@ccsk/cli)
[![license](https://img.shields.io/npm/l/@ccsk/cli.svg)](#license)
[![node](https://img.shields.io/node/v/@ccsk/cli.svg)](https://nodejs.org)
[![platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg)](#)

> **Claude Code Starter Kit** — scaffold a fully-configured Claude Code workspace in one command.

Stop hand-rolling `CLAUDE.md`, agent definitions, and documentation skeletons for every project. `ccsk init` drops a production-ready kit into your repo: workflows, multi-agent orchestrations, slash commands, and everything Claude Code needs to ship real software.

---

## Install

> **This is a global CLI tool, not a project dependency.**

```bash
npm i -g @ccsk/cli
# or: pnpm add -g @ccsk/cli | yarn global add @ccsk/cli | bun add -g @ccsk/cli
```

Requires Node ≥ 20. Verify with `ccsk --version`.

---

## Quick Start

```bash
ccsk auth                  # verify GitHub auth (kits live in private repos)
ccsk auth                  # verify GitHub auth (kits live in private repos)
ccsk init                  # scaffold the kit into current directory
claude                     # open Claude Code
/ccsk-bootstrap <intent>   # generate tech-stack docs, architecture, and plan
```

---

## What You Get

After `ccsk init`, your project has:

```
your-project/
├── CLAUDE.md             # primary Claude Code instructions
├── .claude/              # agents, rules, slash commands
│   ├── agents/           # sub-agent definitions (code-reviewer, debugger, etc.)
│   ├── rules/            # workflow rules (development, documentation)
│   └── commands/         # slash commands including /ccsk-bootstrap
├── .mcp.json             # MCP server configuration
└── docs/                 # documentation skeleton (architecture, standards, roadmap)
```

The `/ccsk-bootstrap` command interviews you about your project, resolves current stack versions, and generates tailored documentation and a phased implementation plan.

---

## Works with ADD

[**ADD (AI-Driven Development)**](https://github.com/pilotspace/ADD) is a methodology where AI writes the code while humans own direction and verification. The workflow: **Specify → Scenarios → Contract → Tests → Build → Verify**.

ccsk + ADD together give you:
- **ccsk** scaffolds Claude Code's rules, agents, and workflows
- **ADD** provides the specification-first, test-driven development loop
- Together: production-grade AI-assisted development from day one

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `command not found: ccsk` | Add your global bin to PATH. npm: `$(npm prefix -g)/bin`. bun: `~/.bun/bin`. |
| `Permission denied (publickey)` | Run `ccsk auth` and follow the setup steps. |
| `GitHub authentication required` | Set up SSH keys or install `gh` CLI and run `gh auth login`. |
| Spinner shows raw text | Expected in CI or when piped — animations degrade gracefully. |

---

## Contributing

We welcome contributions. Open an issue first for anything beyond small fixes.

- **Conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Cross-platform**: test on macOS/Linux/Windows when possible
- **Keep it tight**: no new global tooling without discussion

See [docs/architecture.md](./docs/architecture.md) for module-level details.

---

## Support

- **Issues**: [github.com/ccsk-org/ccsk-cli/issues](https://github.com/ccsk-org/ccsk-cli/issues)
- **Discussions**: [github.com/ccsk-org/ccsk-cli/discussions](https://github.com/ccsk-org/ccsk-cli/discussions)

---

## License

MIT — see [LICENSE](./LICENSE).
