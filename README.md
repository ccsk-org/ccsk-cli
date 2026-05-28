# @ccsk/cli

> **Claude Code Starter Kit** — provision a fully-configured Claude Code workspace into any project in one command.

`ccsk` is a single-binary CLI that pulls curated, opinionated "kits" (CLAUDE.md, `.claude/` configs, MCP servers, agent rules, docs scaffolding) from versioned private repositories and lays them down in your project. License gating, GitHub auth, kit caching, and payment flow are built in.

---

## Quick Start

```bash
# 1. Install globally
npm i -g @ccsk/cli          # or: pnpm add -g @ccsk/cli  /  bun add -g @ccsk/cli

# 2. Verify GitHub auth (kits live in private repos)
ccsk auth

# 3. Scaffold the free Common kit into the current directory
ccsk init

# 4. Open the project in Claude Code — CLAUDE.md, agents, and rules are ready
```

That's the 60-second path. Free `common` kit auto-registers a license on first run. Paid kits offer an in-CLI purchase flow.

---

## Commands

### `ccsk init [path]`

Scaffold a kit into a project directory.

| Flag | Effect |
|------|--------|
| `--kit <id>` | Skip kit picker (`common`, `frontend`, `backend`, `mobile`) |
| `--version <semver>` | Pin to a specific kit version (default: latest) |
| `--force` | Re-clone even if cached |
| `--no-setup` | Skip RTK-AI + context-mode tool install |
| `-y, --yes` | Accept all prompts (CI-safe) |

### `ccsk auth`

Diagnoses GitHub auth — SSH first, `gh` CLI fallback. Prints exact remediation steps if neither works.

### `ccsk cache`

Manage `~/.ccsk/kits/`.

```bash
ccsk cache --list                       # show cached kits
ccsk cache --kit frontend               # pre-download for offline use
ccsk cache --clear --kit frontend       # purge one kit
ccsk cache --clear-all                  # purge everything
```

### `ccsk uninstall [path]`

Remove kit files (`CLAUDE.md`, `.claude/`, `.mcp.json`, `docs/`) from a project. Non-destructive to your application code.

---

## Available Kits

| Kit | Status | Price | What you get |
|-----|--------|-------|--------------|
| `common` | ✅ Stable | Free | Base Claude Code config: rules, skills router, MCP scaffold. **Always free, always required.** |
| `frontend` | ✅ Stable | 265,000 VND lifetime | React/Next.js workflow, UI/UX agents, Tailwind/shadcn patterns, frontend code-review rules |
| `backend` | 🟡 Coming soon | 265,000 VND lifetime | Node/Python API workflow, DB patterns, security rules |
| `mobile`  | 🟡 Coming soon | 265,000 VND lifetime | React Native / Flutter / SwiftUI workflow |

Pricing is operator-editable directly in Supabase (`app_settings` table) — no CLI redeploy needed.

---

## License Model

### Free tier (`common` kit)
First run auto-generates a free key (`CCSK-XXXX-XXXX-XXXX`), saves it to `~/.ccsk/license`, and unlocks the `common` kit. No payment, no email required.

### Paid tier (other kits)
When you select a paid kit without a valid license, ccsk presents a 3-option menu:

```
Frontend kit requires a license.
❯ Already have a license. Enter key
  Purchase a license (265,000 VND - lifetime)
  Back
```

**Already have a license** — paste it; the key is validated, bound, and saved.
**Purchase a license** — see *Payment Flow* below.
**Back** — return to the kit picker.

### Per-account binding
Paid licenses are bound to a single GitHub account on first successful validation. Resolved automatically via `gh api user` / SSH identity — no extra prompt.

* **Same GitHub user, any number of machines** → ✅ works.
* **Different GitHub user, same key (leaked)** → ❌ rejected with `This license is bound to @other-user`.
* **No GitHub auth** → paid kits refuse to install until SSH or `gh` is configured.

Free `common` keys are unbound and shareable — they grant nothing paid.

---

## Payment Flow (paid kits)

Selecting **Purchase a license** runs entirely inside the terminal:

1. **Email prompt** — where you want the license key delivered.
2. **Transaction reservation** — Supabase mints a 6-digit transaction ID and stores a `pending_licenses` row tagged with your email + GitHub username.
3. **Side-by-side VietQR codes** — one QR per enabled bank rendered directly in your terminal (Momo + Techcombank by default). Bank set is loaded from Supabase `payment_banks` table so the operator can add/remove banks without redeploying.
4. **Transfer memo** is pre-filled: `CCSK TT KIT FE 482917` — keep the 6-digit ID for follow-up.
5. **CLI exits cleanly** — no long polling. Once the operator confirms your transfer, the license key is emailed to you. Re-run `ccsk init` and pick **Already have a license. Enter key**.

> **Why manual issuance?** Bank reconciliation is operator-driven for now. The CLI never sees your transfer — it only reserves a transaction ID for matching.

---

## GitHub Authentication

Kits live in private repos under [ccsk-org](https://github.com/ccsk-org). You need **one** of:

| Method | Setup | Recommended for |
|--------|-------|-----------------|
| SSH (key-based) | `ssh-keygen -t ed25519` → add to https://github.com/settings/keys | Long-term, multi-repo |
| `gh` CLI | `brew install gh && gh auth login` | Quick setup, fresh machines |

`ccsk auth` tells you which method is active and how to fix the other.

---

## Offline Use

Pre-fetch kits before going offline:

```bash
ccsk cache --kit common --version 1.0.0
ccsk cache --kit frontend --version 1.0.0
```

Cached at `~/.ccsk/kits/<kit>/<version>/`. `ccsk init` uses cache automatically; pass `--force` to re-fetch.

---

## File Layout (what `ccsk init` puts in your project)

```
your-project/
├── CLAUDE.md             # primary Claude instructions
├── .claude/              # agents, rules, skills, settings
│   ├── agents/
│   ├── rules/
│   └── settings.json
├── .ccsk/                # ccsk runtime config (per-project)
├── .mcp.json             # MCP server configuration
└── docs/                 # project doc scaffolding
```

`_dot_X` directories in kit repos are transformed to `.X` during copy (npm strips literal dotfiles from packed tarballs — this is the workaround).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Could not register free license. HTTP 404` | Supabase Edge Functions not deployed | Operator: deploy `register-free-license` |
| `This license is bound to @other-user` | Key already bound to a different GitHub identity | Switch GitHub account or contact support |
| `GitHub authentication required` on paid kit | Neither SSH nor `gh` is set up | Run `ccsk auth` and follow the printed steps |
| Kit clone fails with `Permission denied (publickey)` | GitHub auth missing for **kit repo** access | Same as above — `ccsk auth` |
| QR codes look broken in terminal | Terminal width / font issue | Pass the printed `vietqr.io` URL to your phone instead |

---

## Local Development

```bash
git clone https://github.com/imnortheastt/ccsk-cli.git
cd ccsk-cli
bun install        # or: npm install
bun run build
bun link           # or: npm link
ccsk --version
```

TypeScript source in `src/`, compiled to `dist/`. Supabase migrations + Edge Functions live under `supabase/`.

---

## Architecture (one paragraph)

A thin Node CLI (`commander` + `@clack/prompts`) reads kit metadata from a static registry, calls Supabase Edge Functions for license validation and payment reservation, falls back to embedded defaults when offline, clones the matching private repo with the user's existing GitHub credentials, and copies the result into the target directory with a small set of name transforms. See [`docs/system-architecture.md`](./docs/system-architecture.md) for module-level detail and [`docs/deployment-guide.md`](./docs/deployment-guide.md) for the publish pipeline.

---

## Contributors

`@ccsk/cli` is engineered by a small group committed to making Claude Code workflows feel professionally tooled, not improvised.

| | Name | Role | Profile |
|---|------|------|---------|
| 🛠 | **Crystal D.** | Author · Maintainer | [@imnortheastt](https://github.com/imnortheastt) |
| 🧭 | **E. Wallis** | Core contributor · Architecture & developer-experience | [@ewalliss](https://github.com/ewalliss) |

We welcome thoughtful contributions. Open an issue first for anything beyond a small fix so we can align on the design before code lands.

---

## License

MIT © Crystal D. and contributors.
