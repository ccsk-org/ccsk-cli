# `@ccsk/cli` — Architecture

A concise map of the CLI as it ships today. Aimed at contributors and reviewers.

## Module layout

```
src/
├── cli.ts                    # commander entry; wires sub-commands
├── commands/
│   ├── init.ts               # main flow: pick → license → fetch → copy → setup
│   ├── cache.ts              # warm/inspect ~/.ccsk/kits
│   ├── uninstall.ts          # kit files + optional global CLI + optional ~/.ccsk wipe
│   └── update.ts             # `ccsk update` → self-update via the detected PM
├── core/
│   ├── kit-registry.ts       # static kit catalogue + price formatter
│   ├── kit-fetcher.ts        # `git clone --depth 1 v<ver>` into ~/.ccsk/kits
│   ├── kit-cache.ts          # cache path resolution + presence check
│   ├── copy-kit.ts           # cache → target project copy
│   ├── remove-kit.ts         # inverse of copy-kit (used by `ccsk uninstall`)
│   ├── license.ts            # Supabase license validation + free auto-register + paid menu
│   ├── payment-config.ts     # Supabase `get-payment-config` (banks + lifetime price)
│   ├── vietqr.ts             # EMVCo VietQR payload + terminal QR + side-by-side render
│   ├── pkg-manager.ts        # detect global owner of @ccsk/cli, run remove cross-PM
│   ├── github-auth.ts        # `gh` / SSH detection for private kit repos
│   ├── self-update.ts        # `npm/pnpm/yarn/bun install -g @ccsk/cli@latest`
│   └── setup-runner.ts       # optional post-install tool setup
└── util/
    ├── banner.ts             # pixel-block "ccsk" gradient wordmark
    ├── log.ts                # picocolors-based log helpers
    ├── platform.ts           # OS detection, homeDir(), binExists() (uses `where`/`which`)
    └── shimmer-spinner.ts    # braille spinner + lavender→teal shimmer + elapsed timer
```

## `ccsk init` data flow

1. **Banner** (`util/banner.ts`) — gradient wordmark, version, capability rail.
2. **Pick kit** (`commands/init.ts → selectKit`).
   - `getPaymentConfig()` (cached) fetches the Supabase-managed lifetime price.
   - `formatKitPrice()` produces the right-hand column: `Free forever`, `<price> VND / Lifetime`, or `<price> VND / Lifetime (coming soon)`.
   - Coming-soon kits short-circuit with a friendly message and exit.
3. **Validate license** (`core/license.ts → validateLicenseForKit`).
   - Saved key → `withShimmer('Validating license for <Kit>…')` wraps the Supabase call.
   - Free kit + no key → `withShimmer('Activating free license…')` wraps `register-free-license`.
   - Paid kit + no/expired key → interactive 3-option menu: enter key / buy / back.
   - Buy → `vietqr.ts` builds EMVCo payload (`vietnam-qr-pay`) + image URL, prints two QR codes.
4. **GitHub auth** (`core/github-auth.ts`) — prefers SSH; falls back to `gh` token.
5. **Fetch kit** (`core/kit-fetcher.ts`) — `git clone --depth 1 --branch v<X>` into `~/.ccsk/kits/<kit>/<version>`. Shallow + `.git` stripped after success. Wrapped in `withShimmer`.
6. **Copy** (`core/copy-kit.ts`) — confirm overwrite, copy from cache into target.
7. **Optional setup** (`core/setup-runner.ts`) — install Claude/Serena/RTK MCPs.

## `ccsk uninstall` data flow

1. Confirm + remove kit files from the target project (`core/remove-kit.ts`).
2. Optionally remove the globally-shared MCP tools (Serena, context-mode, RTK).
3. Optionally remove `@ccsk/cli` itself:
   - `pkg-manager.detectCcskOwner()` probes each PM's `ls -g`/`global list` and string-matches `@ccsk/cli`.
   - `removeCcskGlobally()` calls the detected owner's `remove -g`, verifies by re-checking `ccsk` on PATH; if uninstall failed it walks every PM in order.
   - Prints the owning PM (`Uninstalled @ccsk/cli via pnpm`) or, on total failure, a manual fallback list for npm/pnpm/yarn/bun.
4. Optionally wipe `~/.ccsk` (license key + cache). Off by default in `--yes` mode.

## State on disk

| Path | Owner | Contents |
| --- | --- | --- |
| `~/.ccsk/license` | `core/license.ts` | Single line; the activated CCSK key. |
| `~/.ccsk/kits/<kit>/<version>/` | `core/kit-cache.ts` | Shallow-cloned kit contents. Safe to delete. |

## Remote dependencies

| Surface | Endpoint | Owner |
| --- | --- | --- |
| License validate | `POST /functions/v1/validate-license` | `core/license.ts` |
| Free license register | `POST /functions/v1/register-free-license` | `core/license.ts` |
| Pending license (paid) | `POST /functions/v1/create-pending-license` | `core/vietqr.ts` |
| Payment config | `GET /functions/v1/get-payment-config` | `core/payment-config.ts` |
| Kit tarballs | `git clone` of `github.com/ccsk-org/<kit>-kit` | `core/kit-fetcher.ts` |
| QR image fallback | `https://api.vietqr.io/image/...` | `core/vietqr.ts` |

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
