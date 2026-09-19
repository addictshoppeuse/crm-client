import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function requireActiveAdmin(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Authentication required'), { status: 401 })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw Object.assign(new Error('Server configuration unavailable'), { status: 500 })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) throw Object.assign(new Error('Authentication required'), { status: 401 })
  const { data: membership, error } = await admin.from('memberships')
    .select('id,organization_id,user_id,role,state')
    .eq('user_id', userData.user.id).eq('role', 'admin').eq('state', 'active').maybeSingle()
  if (error || !membership) throw Object.assign(new Error('Administrator access required'), { status: 403 })
  return { admin, user: userData.user, membership }
}

export function safeError(error: unknown) {
  const candidate = error as { status?: number }
  const status = Number.isInteger(candidate?.status) ? Number(candidate.status) : 500
  const message = status === 500 ? 'Operation unavailable' : (error instanceof Error ? error.message : 'Request rejected')
  return json({ error: message }, status)
}
