/**
 * Validate license key for a specific kit + GitHub account binding.
 * POST { key, kit, github_username? }
 * Returns { valid, reason?, entitlements? }
 *
 * Binding rule (soft, unlimited machines, same GH user):
 *   If license.github_username is NULL → first successful validate binds it.
 *   If license.github_username is set  → request github_username MUST match, else reject.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { key, kit, github_username } = await req.json()

    if (!key) {
      return Response.json(
        { valid: false, reason: 'License key required' },
        { headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: license, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('key', key)
      .single()

    if (error || !license) {
      return Response.json(
        { valid: false, reason: 'Invalid license key' },
        { headers: corsHeaders }
      )
    }

    if (license.status !== 'active') {
      return Response.json(
        { valid: false, reason: 'License is not active' },
        { headers: corsHeaders }
      )
    }

    const entitlements: string[] = license.kit_entitlements ?? ['common']

    if (kit && !entitlements.includes(kit)) {
      return Response.json(
        { valid: false, reason: `License does not include ${kit} kit`, entitlements },
        { headers: corsHeaders }
      )
    }

    // Per-account binding (paid tiers only — free 'common' keys are unbound).
    const isPaidTier = license.tier && license.tier !== 'free'
    if (isPaidTier) {
      if (!github_username) {
        return Response.json(
          { valid: false, reason: 'GitHub authentication required for this license' },
          { headers: corsHeaders }
        )
      }

      if (license.github_username && license.github_username !== github_username) {
        return Response.json(
          {
            valid: false,
            reason: `This license is bound to @${license.github_username}. Sign in with that GitHub account or contact support.`,
          },
          { headers: corsHeaders }
        )
      }

      // First-use bind: lock the license to the current GitHub account.
      if (!license.github_username) {
        await supabase
          .from('licenses')
          .update({ github_username, last_used: new Date().toISOString() })
          .eq('id', license.id)

        return Response.json(
          { valid: true, entitlements, bound_to: github_username },
          { headers: corsHeaders }
        )
      }
    }

    await supabase
      .from('licenses')
      .update({ last_used: new Date().toISOString() })
      .eq('id', license.id)

    return Response.json(
      { valid: true, entitlements },
      { headers: corsHeaders }
    )
  } catch (_err) {
    return Response.json(
      { valid: false, reason: 'Validation error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
