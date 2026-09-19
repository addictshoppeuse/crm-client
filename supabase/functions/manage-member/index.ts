import { corsHeaders, json, requireActiveAdmin, safeError } from '../_shared/authorization.ts'

const allowedActions = ['disable', 'enable', 'set-role'] as const

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { admin, membership: caller } = await requireActiveAdmin(req)
    const body = await req.json().catch(() => null)
    const membershipId = String(body?.membershipId || '')
    const action = String(body?.action || '')
    const role = String(body?.role || '')
    if (!/^[0-9a-f-]{36}$/i.test(membershipId) || !allowedActions.includes(action as typeof allowedActions[number])) {
      return json({ error: 'Action invalide' }, 400)
    }
    if (action === 'set-role' && !['admin', 'collaborator'].includes(role)) return json({ error: 'Rôle invalide' }, 400)
    const { data: target, error: targetError } = await admin.from('memberships').select('*')
      .eq('id', membershipId).eq('organization_id', caller.organization_id).maybeSingle()
    if (targetError || !target) return json({ error: 'Membre introuvable' }, 404)

    const removesAdmin = target.role === 'admin' && target.state === 'active' &&
      (action === 'disable' || (action === 'set-role' && role !== 'admin'))
    if (removesAdmin) {
      const { count: activeAdminCount } = await admin.from('memberships').select('id', { count: 'exact', head: true })
        .eq('organization_id', caller.organization_id).eq('role', 'admin').eq('state', 'active')
      if ((activeAdminCount || 0) <= 1) return json({ error: 'Le dernier administrateur actif doit être conservé' }, 409)
    }

    const changes = action === 'disable' ? { state: 'disabled' }
      : action === 'enable' ? { state: 'active' }
        : { role }
    const { error } = await admin.from('memberships').update(changes).eq('id', membershipId)
    if (error) throw error
    return json({ membershipId, updated: true })
  } catch (error) {
    return safeError(error)
  }
})
