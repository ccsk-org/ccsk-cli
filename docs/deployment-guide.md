# Deployment Guide — @ccsk/cli

End-to-end operator runbook for shipping the CLI to npm and the backend to Supabase.

---

## 1. npm Publishing

The CLI ships as `@ccsk/cli`. Releases are automated via GitHub Actions (`.github/workflows/publish.yml`).

### One-time setup

1. Create the `@ccsk` org on npmjs.com.
2. Generate an npm access token with **Automation → Publish** permission.
3. Add it as `NPM_TOKEN` in GitHub → ccsk-cli → Settings → Secrets.

### Release process

```bash
# 1. Bump version (or skip to republish current version)
npm version patch        # → 1.0.0 → 1.0.1
git push --follow-tags

# 2. Trigger publish via GitHub Release
gh release create v1.0.1 --generate-notes
```

The workflow runs `npm publish --access public` automatically.

### Manual publish (no version bump)

```bash
npm run build
npm publish --access public
```

Use this for re-publishing the **current** version after non-version-affecting fixes (e.g. fixing the `dist/` payload).

---

## 2. Supabase

### CLI bootstrap

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-id>      # ours: qorrssuqkblahzzlonhz
```

### Apply migrations

```bash
supabase db push
```

Or paste each `supabase/migrations/*.sql` file into the Supabase SQL Editor, in order:

1. `001_licenses_schema.sql` — base tables.
2. `002_per_account_binding.sql` — display txn id, GH-username binding.
3. `003_payment_config.sql` — operator-editable banks + price.

### Deploy Edge Functions

```bash
supabase functions deploy validate-license
supabase functions deploy register-free-license
supabase functions deploy create-pending-license
supabase functions deploy check-payment-status
supabase functions deploy get-payment-config
```

All five are required for a working CLI. A 404 from any of them surfaces back to the user as a clear `HTTP 404` error in the install flow.

### Verify the deploy

```bash
# free-license should return a fresh key
curl -X POST -H 'Authorization: Bearer <ANON_KEY>' \
  https://<project>.supabase.co/functions/v1/register-free-license -d '{}'

# payment config should return banks + price
curl -H 'Authorization: Bearer <ANON_KEY>' \
  https://<project>.supabase.co/functions/v1/get-payment-config
```

### Environment

Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Source |
|--------|--------|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |

No external secrets are needed for the current flow (no bank webhook, no email transactional service).

---

## 3. Editing prices and banks (no redeploy)

Banks and the lifetime price live in Supabase tables. To change them:

| Change | Where | How |
|--------|-------|-----|
| Update lifetime price | `app_settings` row where `key = 'lifetime_price_vnd'` | Edit `value` (JSONB), e.g. `380000` |
| Add a new bank | `payment_banks` | Insert row with `label, bin, account_number, account_name, sort_order` |
| Disable a bank temporarily | `payment_banks` | Set `enabled = false` |
| Change account holder name | `payment_banks` | Edit `account_name` on each affected row |

CLI clients pick up changes on their **next run** — no version bump, no re-publish.

---

## 4. Kit Repo Releases

Each kit is an independent private repo under `ccsk-org/`. Versioning is git-tag-driven.

```bash
cd ccsk-frontend-kit
git add -A
git commit -m "feat: add new component patterns"
git tag v1.1.0
git push --tags
```

The CLI clones with `git clone --branch v<version>` on demand.

---

## 5. Manual license issuance (current operator workflow)

When a user completes the **Purchase** flow:

1. Look in `pending_licenses` for the row matching the bank-memo's 6-digit `display_txn_id`.
2. Confirm transfer in your bank app (memo matches `CCSK TT KIT FE 482917`).
3. Generate a license key (any `CCSK-XXXX-XXXX-XXXX`).
4. Insert into `licenses`:

   ```sql
   INSERT INTO licenses (key, email, kit_entitlements, tier, status)
   VALUES ('CCSK-AAAA-BBBB-CCCC', '<pending.email>', ARRAY['common','frontend'], 'pro', 'active');
   ```

5. Update the pending row:

   ```sql
   UPDATE pending_licenses
   SET status = 'issued'
   WHERE display_txn_id = '<id>';
   ```

6. Email the key to `pending.email`. The user re-runs `ccsk init` and chooses **Already have a license. Enter key**.

> The `github_username` field is **left null on issuance** — it gets bound automatically on the user's first successful `validate-license` call. This avoids mismatches when the user's `gh` identity differs from what was captured pre-payment.

---

## 6. Rollback

### npm

```bash
npm deprecate @ccsk/cli@1.0.1 "Bug — use 1.0.0"
# or, within 72h of publish:
npm unpublish @ccsk/cli@1.0.1
```

### Edge Functions

Edge Functions don't have a built-in version history. Roll back by re-deploying from a previous git ref:

```bash
git checkout <previous-sha> -- supabase/functions/validate-license
supabase functions deploy validate-license
```

### Migrations

Migrations are forward-only. Author a new compensating migration rather than reversing a previous one.

---

## 7. Monitoring

| Surface | Where |
|---------|-------|
| Edge Function logs | Supabase Dashboard → Edge Functions → Logs |
| License usage | `licenses` table — group by `kit_entitlements`, `tier` |
| Stale pendings | `SELECT * FROM pending_licenses WHERE status='awaiting_payment' AND created_at < now() - INTERVAL '24 hours'` |
| npm downloads | https://npm-stat.com/charts.html?package=%40ccsk%2Fcli |

---

## 8. Secrets Summary

| Secret | Location | Purpose |
|--------|----------|---------|
| `NPM_TOKEN` | GitHub → ccsk-cli → Secrets | npm publish from CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project env | Edge Function DB access |
| GitHub credentials | End-user's machine (SSH / `gh`) | Clone private kit repos |
