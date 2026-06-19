/**
 * Register an install for tracking purposes.
 * POST { github_username?: string, email?: string, kit_version?: string }
 * Returns { success: true }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InstallPayload {
  github_username?: string | null
  email?: string | null
  kit_version?: string | null
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

    const payload: InstallPayload = await req.json()

    const { error } = await supabase
      .from('installs')
      .insert({
        github_username: payload.github_username ?? null,
        email: payload.email ?? null,
        kit_version: payload.kit_version ?? null,
        installed_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Insert error:', error)
      return Response.json(
        { success: false, error: 'Could not record install' },
        { status: 500, headers: corsHeaders }
      )
    }

    return Response.json(
      { success: true },
      { headers: corsHeaders }
    )

  } catch (err) {
    console.error('Error:', err)
    return Response.json(
      { success: false, error: 'Registration error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
