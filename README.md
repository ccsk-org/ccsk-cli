# @ccsk/cli

Claude Code Starter Kit — scaffold Claude-ready projects in one command.

## Installation

```bash
# With npm
npm install -g @ccsk/cli

# With pnpm
pnpm add -g @ccsk/cli

# With bun
bun add -g @ccsk/cli
```

## Quick Start

```bash
# Install a kit in your project
ccsk init

# Or specify a kit directly
ccsk init --kit frontend
```

## Commands

### `ccsk init [path]`

Install a Claude Code starter kit into a project.

```bash
ccsk init                      # Interactive mode
ccsk init --kit frontend       # Install frontend kit
ccsk init --kit common         # Install free common kit
ccsk init --version 1.0.0      # Pin to specific version
ccsk init --force              # Re-download even if cached
ccsk init --no-setup           # Skip RTK-AI + context-mode setup
ccsk init -y                   # Accept all prompts
```

### `ccsk auth`

Check GitHub authentication status. Required for downloading kits.

```bash
ccsk auth
```

### `ccsk cache`

Manage downloaded kit cache for offline use.

```bash
ccsk cache --list              # List cached kits
ccsk cache --kit frontend      # Download frontend kit
ccsk cache --clear --kit frontend  # Clear frontend cache
ccsk cache --clear-all         # Clear all cached kits
```

### `ccsk uninstall [path]`

Remove kit files from a project.

```bash
ccsk uninstall                 # Interactive mode
ccsk uninstall -y              # Accept removal prompt
```

## Available Kits

| Kit | Price | Description |
|-----|-------|-------------|
| `common` | Free | Base Claude Code configuration |
| `frontend` | Paid | React/Next.js patterns, UI/UX workflows |
| `backend` | Paid | Node.js/Python backend patterns (coming soon) |
| `mobile` | Paid | React Native/Flutter patterns (coming soon) |

## License

A license key is required to use ccsk. Free licenses are auto-generated for the `common` kit.

For paid kits, contact: duongdong2203@gmail.com

## Authentication

ccsk downloads kits from private GitHub repositories. You need either:

1. **SSH keys** configured for GitHub (recommended)
2. **GitHub CLI** (`gh`) authenticated

Run `ccsk auth` to check your authentication status.

## Offline Use

Pre-download kits for offline use:

```bash
ccsk cache --kit frontend --version 1.0.0
```

Cached kits are stored in `~/.ccsk/kits/`.

## Development

```bash
git clone https://github.com/imnortheastt/ccsk-cli.git
cd ccsk-cli
bun install
bun run build
bun link
ccsk --version
```

## License

MIT
