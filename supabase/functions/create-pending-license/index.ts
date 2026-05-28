/**
 * Create a pending license record for a VietQR payment.
 * POST { email, github_username, kit, amount_vnd }
 * Returns { id, display_txn_id, expires_at }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateDisplayTxnId(): string {
  // 6-digit numeric, leading zero allowed. Operator searches by this in bank memo.
  return Math.floor(100000 + Math.random() * 900000).toString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, github_username, kit, amount_vnd } = await req.json()

    if (!email || !github_username || !kit || !amount_vnd) {
      return Response.json(
        { error: 'Missing required fields: email, github_username, kit, amount_vnd' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Retry on display_txn_id collision (extremely rare with 900k space).
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const displayTxnId = generateDisplayTxnId()
      // user_hash kept for backward-compat with old schema NOT NULL constraint.
      const userHash = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

      const { data, error } = await supabase
        .from('pending_licenses')
        .insert({
          email,
          github_username,
          kit,
          user_hash: userHash,
          required_amount: amount_vnd,
          amount_vnd,
          display_txn_id: displayTxnId,
          status: 'awaiting_payment',
        })
        .select('id, display_txn_id, expires_at')
        .single()

      if (!error && data) {
        return Response.json(data, { headers: corsHeaders })
      }

      lastError = error
      // 23505 = unique violation; retry. Anything else: bail.
      if (error?.code !== '23505') break
    }

    return Response.json(
      { error: 'Could not allocate transaction id', details: lastError },
      { status: 500, headers: corsHeaders }
    )
  } catch (err) {
    return Response.json(
      { error: 'Server error', details: (err as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }
})
