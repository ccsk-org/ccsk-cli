# Deployment Guide — @ccsk/cli

## npm Publishing

The CLI is published to npm as `@ccsk/cli`. Releases are automated via GitHub Actions.

### Prerequisites

1. Create `@ccsk` organization on npmjs.com
2. Generate npm access token with publish permissions
3. Add `NPM_TOKEN` secret to ccsk-cli repository

### Release Process

```bash
# 1. Bump version
npm version patch|minor|major

# 2. Push with tags
git push --follow-tags

# 3. Create GitHub Release (triggers publish)
gh release create v1.0.0 --generate-notes
```

The `publish.yml` workflow automatically publishes to npm when a release is created.

## Supabase Deployment

### Edge Functions

Deploy functions via Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref <project-id>

# Deploy functions
supabase functions deploy validate-license
supabase functions deploy register-free-license
supabase functions deploy check-payment-status
```

### Database Migration

```bash
supabase db push
```

Or run manually in Supabase SQL Editor:

```sql
-- See supabase/migrations/001_licenses_schema.sql
```

### Environment Variables

Set in Supabase Dashboard → Edge Functions → Secrets:

- `SUPABASE_URL` — Auto-set
- `SUPABASE_SERVICE_ROLE_KEY` — Auto-set

## Kit Releases

Each kit repo is versioned independently:

```bash
cd ccsk-frontend-kit

# Make changes
git add -A
git commit -m "feat: add new component patterns"

# Tag release
git tag v1.1.0
git push --tags
```

CLI fetches by tag: `git clone --branch v1.1.0`

## Payment Webhook

To enable VietQR auto-activation:

1. Set up bank webhook to call your endpoint
2. Create `payment-webhook` Edge Function
3. Function creates license + invites user to GitHub repo

```typescript
// POST /functions/v1/payment-webhook
// See supabase/functions/payment-webhook/index.ts
```

## Monitoring

### License Validation

Check Supabase Dashboard → Edge Functions → Logs

### Usage Metrics

Query `licenses` table:

```sql
SELECT 
  kit_entitlements,
  COUNT(*) as count
FROM licenses
GROUP BY kit_entitlements;
```

## Rollback

### npm Package

```bash
npm unpublish @ccsk/cli@1.0.1
# or deprecate
npm deprecate @ccsk/cli@1.0.1 "Bug in this version, use 1.0.2"
```

### Edge Functions

```bash
# Redeploy previous version
git checkout v1.0.0
supabase functions deploy validate-license
```

## Secrets Summary

| Secret | Location | Purpose |
|--------|----------|---------|
| `NPM_TOKEN` | GitHub → ccsk-cli | npm publish |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Edge Functions DB access |
| GitHub repo access | User's SSH/gh | Clone private kit repos |
