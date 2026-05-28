# System Architecture — @ccsk/cli

> Module-level view of ccsk-cli: surfaces, data flow, backend contracts.

## Overview

ccsk-cli is a kit-fetching CLI that:

1. Validates per-kit licenses via Supabase, with per-GitHub-account binding for paid tiers.
2. Authenticates the user with GitHub (SSH-first, `gh` CLI fallback).
3. Clones kits from private GitHub repos into a local cache.
4. Copies cached kits into the target project, applying name transforms.
5. Optionally runs follow-up tool setup (RTK-AI, context-mode).

All payment configuration (banks, lifetime price) and license records live in Supabase so the operator can edit them without redeploying the CLI.

---

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  ccsk init                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Select kit ──► common (free) | frontend | backend | mobile (paid)       │
│         │                                                                   │
│         ▼                                                                   │
│  2. Validate license (Supabase Edge Function)                               │
│       free  → auto-register, save key                                       │
│       paid  → 3-option menu:                                                │
│              ├─ Enter key      → validate (+ GitHub-bind on first use)      │
│              ├─ Purchase       → email → reserve txn → render 2 QRs → exit  │
│              └─ Back           → return to kit picker                       │
│         │                                                                   │
│         ▼                                                                   │
│  3. GitHub auth (SSH → gh CLI → guided setup if missing)                    │
│         │                                                                   │
│         ▼                                                                   │
│  4. Fetch kit (cache hit | git clone --branch <version>)                    │
│         │                                                                   │
│         ▼                                                                   │
│  5. Copy to target (`_dot_X` → `.X` transform, verbatim otherwise)          │
│         │                                                                   │
│         ▼                                                                   │
│  6. Optional tool setup (RTK-AI + context-mode)                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Responsibilities

### Commands (`src/commands/`)

| Module          | Command           | Purpose                                                |
|-----------------|-------------------|--------------------------------------------------------|
| `init.ts`       | `ccsk init`       | Orchestrator: kit → license → auth → fetch → copy      |
| `auth.ts`       | `ccsk auth`       | Diagnose GitHub auth (SSH / gh)                        |
| `cache.ts`      | `ccsk cache`      | Manage `~/.ccsk/kits/`                                 |
| `uninstall.ts`  | `ccsk uninstall`  | Remove kit files from a project                        |

### Core (`src/core/`)

| Module               | Purpose                                                                       |
|----------------------|-------------------------------------------------------------------------------|
| `kit-registry.ts`    | Static kit catalog (id, label, repo, pricing, default version).               |
| `license.ts`         | License validation, free auto-registration, **3-option paid-kit menu**.       |
| `payment-config.ts`  | Loads banks + lifetime price from Supabase, caches per-run, offline fallback. |
| `vietqr.ts`          | Purchase flow: email prompt is upstream; this module renders the QR(s).       |
| `github-auth.ts`     | SSH detection, gh CLI fallback, username resolution.                          |
| `kit-fetcher.ts`     | Cache lookup + git clone of versioned kit repos.                              |
| `kit-cache.ts`       | Layout + management of `~/.ccsk/kits/`.                                       |
| `copy-kit.ts`        | Copy cached kit to target with `_dot_X → .X` transforms.                      |
| `setup-runner.ts`    | Bootstraps RTK-AI + context-mode if user opts in.                             |

---

## Cache Structure

```
~/.ccsk/
├── license                       # saved license key (CCSK-XXXX-XXXX-XXXX)
├── config.json                   # user preferences
└── kits/
    ├── common/
    │   └── 1.0.0/                # full kit contents (no .git)
    ├── frontend/
    │   ├── 1.0.0/
    │   └── 1.1.0/                # multiple versions coexist
    └── backend/
        └── 1.0.0/
```

---

## Backend (Supabase)

### Edge Functions

| Function                  | Input                                                          | Output                                                  |
|---------------------------|----------------------------------------------------------------|---------------------------------------------------------|
| `validate-license`        | `{ key, kit, github_username? }`                               | `{ valid, reason?, entitlements?, bound_to? }`          |
| `register-free-license`   | `{}`                                                           | `{ key, entitlements }`                                 |
| `create-pending-license`  | `{ email, github_username, kit, amount_vnd }`                  | `{ id, display_txn_id, expires_at }`                    |
| `check-payment-status`    | `{ userHash, kit }`                                            | `{ paid, licenseKey? }`                                 |
| `get-payment-config`      | *(none)*                                                       | `{ lifetime_price_vnd, banks: [{ label, bin, ... }] }`  |

### Per-account binding rule (paid tier)

* `licenses.github_username IS NULL` → first successful validate **binds** the row to the requesting GitHub user.
* `licenses.github_username = req.github_username` → ✅ accept, unlimited machines.
* `licenses.github_username != req.github_username` → ❌ reject with `bound to @<owner>`.
* Free tier (`tier = 'free'`) is **never bound** and is shareable by design.

### Database Schema (essentials)

```sql
licenses (
  key TEXT UNIQUE,
  email TEXT,
  github_username TEXT,                       -- set on first paid validation
  kit_entitlements TEXT[],                    -- ['common', 'frontend']
  tier TEXT,                                  -- 'free' | 'pro' | 'enterprise'
  status TEXT,                                -- 'active' | 'revoked' | 'expired'
  last_used TIMESTAMPTZ
)

pending_licenses (
  email TEXT,
  github_username TEXT,
  kit TEXT,
  amount_vnd INTEGER,
  display_txn_id CHAR(6) UNIQUE,              -- 6-digit memo ID
  status TEXT DEFAULT 'awaiting_payment',
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
)

payment_banks (
  label TEXT,                                 -- 'Momo', 'Techcombank'
  bin TEXT,                                   -- VietQR bank BIN
  account_number TEXT,                        -- account or phone (e-wallet)
  account_name TEXT,
  enabled BOOLEAN,
  sort_order INTEGER
)

app_settings (
  key TEXT PRIMARY KEY,
  value JSONB                                 -- e.g. 'lifetime_price_vnd' → 265000
)
```

Migrations live under `supabase/migrations/` and are applied in order:

* `001_licenses_schema.sql` — base license + pending tables.
* `002_per_account_binding.sql` — adds `display_txn_id`, `status`, 7-day TTL, GH-username indexes.
* `003_payment_config.sql` — `payment_banks` + `app_settings` for operator-editable config.

---

## Kit Repos

Each kit is an independent private repo under `ccsk-org/`:

```
ccsk-org/<name>-kit/
├── CLAUDE.md                     # primary Claude instructions
├── docs/                         # project documentation templates
├── _dot_claude/                  # → .claude/ on install
├── _dot_ccsk/                    # → .ccsk/ on install
├── _dot_mcp.json                 # → .mcp.json on install
└── VERSION                       # semver tag for releases
```

The `_dot_` prefix bypasses npm packing rules that would otherwise drop literal dotfiles.

---

## Cross-Platform Support

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon + Intel) | ✅ |
| Linux                         | ✅ |
| Windows (PowerShell / WSL)    | ✅ (uses `where` instead of `which`) |

Both SSH and `gh` CLI authentication paths are cross-platform.

---

## Security Posture

| Concern | Mitigation |
|---------|------------|
| License key reuse across users | Per-GitHub-account binding on paid tier; first-use lock, mismatch rejection |
| Secrets in CLI bundle | Only Supabase **anon** publishable key is shipped; service role lives in Edge Function env vars |
| Private kit repo access | Delegated entirely to the user's existing GitHub credentials (SSH / `gh`) |
| Payment confirmation | Manual operator reconciliation today; webhook hook-point exists for future automation |
| Bank/price tampering | Stored in Supabase; only service-role writes via dashboard or admin tooling |
