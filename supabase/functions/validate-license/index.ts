/**
 * Validate license key for a specific kit.
 * POST { key: string, kit: string }
 * Returns { valid: boolean, reason?: string, entitlements?: string[] }
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
    const { key, kit } = await req.json()

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

    // Check if license is active
    if (license.status !== 'active') {
      return Response.json(
        { valid: false, reason: 'License is not active' },
        { headers: corsHeaders }
      )
    }

    // Check if license includes the requested kit
    const entitlements: string[] = license.kit_entitlements ?? ['common']

    if (kit && !entitlements.includes(kit)) {
      return Response.json(
        {
          valid: false,
          reason: `License does not include ${kit} kit`,
          entitlements
        },
        { headers: corsHeaders }
      )
    }

    // Update last_used timestamp
    await supabase
      .from('licenses')
      .update({ last_used: new Date().toISOString() })
      .eq('id', license.id)

    return Response.json(
      { valid: true, entitlements },
      { headers: corsHeaders }
    )

  } catch (err) {
    return Response.json(
      { valid: false, reason: 'Validation error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
