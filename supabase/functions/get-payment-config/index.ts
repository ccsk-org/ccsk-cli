/**
 * Return payment configuration for the CLI purchase flow.
 * GET → { lifetime_price_vnd, banks: [{ label, bin, account_number, account_name }] }
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const [{ data: banks }, { data: priceRow }] = await Promise.all([
      supabase
        .from('payment_banks')
        .select('label, bin, account_number, account_name')
        .eq('enabled', true)
        .order('sort_order'),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'lifetime_price_vnd')
        .single(),
    ])

    const lifetime_price_vnd = Number(priceRow?.value ?? 265000)

    return Response.json(
      { lifetime_price_vnd, banks: banks ?? [] },
      { headers: corsHeaders }
    )
  } catch (err) {
    return Response.json(
      { error: 'Could not load payment config', details: (err as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }
})
