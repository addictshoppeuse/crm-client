import { corsHeaders, json, requireActiveAdmin, safeError } from '../_shared/authorization.ts'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { admin, user, membership } = await requireActiveAdmin(req)
    const body = await req.json().catch(() => null)
    const email = String(body?.email || '').trim().toLowerCase()
    const displayName = String(body?.displayName || '').trim()
    if (!emailPattern.test(email) || email.length > 254 || displayName.length > 120) {
      return json({ error: 'Adresse ou nom invalide' }, 400)
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: displayName },
    })
    if (inviteError || !invited.user) return json({ error: 'Ce compte existe déjà ou ne peut pas être invité' }, 409)
    const { data: created, error: membershipError } = await admin.from('memberships').insert({
      organization_id: membership.organization_id,
      user_id: invited.user.id,
      role: 'collaborator',
      state: 'active',
      display_name: displayName,
      email,
      created_by: user.id,
    }).select('id').single()
    if (membershipError) {
      await admin.auth.admin.deleteUser(invited.user.id)
      return json({ error: 'Invitation non enregistrée' }, 409)
    }
    return json({ membershipId: created.id, invited: true })
  } catch (error) {
    return safeError(error)
  }
})
