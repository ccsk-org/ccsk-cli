/**
 * Register a free license for common kit.
 * POST {}
 * Returns { key: string, entitlements: string[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `CCSK-${segment()}-${segment()}-${segment()}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Generate unique key
    let key: string
    let attempts = 0

    do {
      key = generateKey()
      const { data } = await supabase
        .from('licenses')
        .select('id')
        .eq('key', key)
        .single()

      if (!data) break
      attempts++
    } while (attempts < 10)

    if (attempts >= 10) {
      return Response.json(
        { error: 'Could not generate unique key' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Insert free license
    const entitlements = ['common']

    const { error } = await supabase
      .from('licenses')
      .insert({
        key,
        kit_entitlements: entitlements,
        tier: 'free',
        status: 'active',
        created_at: new Date().toISOString(),
      })

    if (error) {
      return Response.json(
        { error: 'Could not create license' },
        { status: 500, headers: corsHeaders }
      )
    }

    return Response.json(
      { key, entitlements },
      { headers: corsHeaders }
    )

  } catch (err) {
    return Response.json(
      { error: 'Registration error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
