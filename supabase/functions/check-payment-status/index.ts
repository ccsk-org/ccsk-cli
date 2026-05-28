/**
 * Check if payment has been received for a pending license.
 * POST { userHash: string, kit: string }
 * Returns { paid: boolean, licenseKey?: string }
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
    const { userHash, kit } = await req.json()

    if (!userHash || !kit) {
      return Response.json(
        { paid: false, reason: 'Missing userHash or kit' },
        { headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if a license has been created for this user/kit combo
    const { data: license } = await supabase
      .from('licenses')
      .select('key, kit_entitlements')
      .eq('user_hash', userHash)
      .contains('kit_entitlements', [kit])
      .single()

    if (license) {
      return Response.json(
        { paid: true, licenseKey: license.key },
        { headers: corsHeaders }
      )
    }

    return Response.json(
      { paid: false },
      { headers: corsHeaders }
    )

  } catch (err) {
    return Response.json(
      { paid: false, error: 'Check error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
