/**
 * Record a donation attempt for tracking.
 * POST { tier: string, amount_usd: number, amount_vnd: number, email?: string, memo: string }
 * Returns { success: true, id: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DonationPayload {
  tier: string
  amount_usd: number
  amount_vnd: number
  email?: string | null
  memo: string
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

    const payload: DonationPayload = await req.json()

    if (!payload.tier || !payload.amount_usd || !payload.amount_vnd || !payload.memo) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { data, error } = await supabase
      .from('donations')
      .insert({
        tier: payload.tier,
        amount_usd: payload.amount_usd,
        amount_vnd: payload.amount_vnd,
        email: payload.email ?? null,
        memo: payload.memo,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Insert error:', error)
      return Response.json(
        { success: false, error: 'Could not record donation' },
        { status: 500, headers: corsHeaders }
      )
    }

    return Response.json(
      { success: true, id: data.id },
      { headers: corsHeaders }
    )

  } catch (err) {
    console.error('Error:', err)
    return Response.json(
      { success: false, error: 'Recording error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
