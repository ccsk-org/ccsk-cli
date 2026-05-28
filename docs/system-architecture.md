# System Architecture — @ccsk/cli

> How ccsk-cli is structured: modules, data flow, backend integration.

## Overview

ccsk-cli is a kit-fetching CLI that:
1. Validates per-kit licenses via Supabase
2. Authenticates with GitHub (SSH or gh CLI)
3. Clones kits from private repos to local cache
4. Copies cached kits to target projects

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ccsk init                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Select kit ──► common (free) | frontend | backend | mobile (paid)  │
│         │                                                               │
│         ▼                                                               │
│  2. Validate license ──► Supabase Edge Function                         │
│         │                 └─► Free: auto-register                       │
│         │                 └─► Paid: VietQR payment flow                 │
│         ▼                                                               │
│  3. GitHub auth ──► SSH check ──► gh CLI fallback ──► Guide setup      │
│         │                                                               │
│         ▼                                                               │
│  4. Fetch kit ──► Check cache ──► Clone if needed ──► Cache locally    │
│         │                                                               │
│         ▼                                                               │
│  5. Copy to target ──► _dot_X → .X transform ──► Verbatim copy         │
│         │                                                               │
│         ▼                                                               │
│  6. Tool setup (optional) ──► RTK-AI + context-mode                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### Commands (`src/commands/`)

| Module | Command | Purpose |
|--------|---------|---------|
| `init.ts` | `ccsk init` | Main orchestrator: kit → license → auth → fetch → copy |
| `auth.ts` | `ccsk auth` | Display GitHub auth status |
| `cache.ts` | `ccsk cache` | Manage kit cache |
| `uninstall.ts` | `ccsk uninstall` | Remove kit files |

### Core (`src/core/`)

| Module | Purpose |
|--------|---------|
| `kit-registry.ts` | Kit metadata: repo URLs, pricing, versions |
| `license.ts` | Validate/register licenses via Supabase |
| `github-auth.ts` | SSH detection, gh CLI fallback |
| `kit-fetcher.ts` | Clone kits to cache |
| `kit-cache.ts` | Manage `~/.ccsk/kits/` |
| `vietqr.ts` | Payment flow for paid kits |
| `copy-kit.ts` | Copy kit to target with transforms |
| `setup-runner.ts` | RTK-AI + context-mode installation |

## Cache Structure

```
~/.ccsk/
├── license                   # Saved license key (CCSK-XXXX-XXXX-XXXX)
├── config.json               # User preferences
└── kits/
    ├── common/
    │   └── 1.0.0/            # Full kit contents (no .git)
    ├── frontend/
    │   ├── 1.0.0/
    │   └── 1.1.0/            # Multiple versions coexist
    └── backend/
        └── 1.0.0/
```

## Backend (Supabase)

### Edge Functions

| Function | Input | Output |
|----------|-------|--------|
| `validate-license` | `{key, kit}` | `{valid, entitlements[]}` |
| `register-free-license` | `{}` | `{key, entitlements[]}` |
| `check-payment-status` | `{userHash, kit}` | `{paid, licenseKey?}` |

### Database Schema

```sql
licenses (
  key TEXT UNIQUE,
  kit_entitlements TEXT[],  -- ['common', 'frontend']
  tier TEXT,                -- 'free' | 'pro' | 'enterprise'
  status TEXT               -- 'active' | 'revoked'
)

pending_licenses (
  user_hash TEXT,
  kit TEXT,
  required_amount INTEGER
)
```

## Kit Repos

Each kit is a separate private GitHub repo:

```
ccsk-{name}-kit/
├── CLAUDE.md               # Main Claude instructions
├── docs/                   # Project documentation templates
├── _dot_claude/            # → .claude/ on install
├── _dot_ccsk/              # → .ccsk/ on install
├── _dot_mcp.json           # → .mcp.json on install
└── VERSION                 # Kit version number
```

The `_dot_` prefix is transformed to `.` during copy (npm strips dotfiles).

## Cross-Platform Support

- **macOS**: Full support (Apple Silicon + Intel)
- **Linux**: Full support
- **Windows**: Full support (uses `where` instead of `which`)

SSH and gh CLI both work cross-platform.

## Security

- License keys are validated server-side on every init
- Kit repos are private; requires GitHub auth
- No secrets stored in CLI code (anon key only)
- Payment verification is server-side
