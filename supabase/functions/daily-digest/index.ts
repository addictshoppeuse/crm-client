// Rappel quotidien par email : relances du jour et en retard, envoyé à chaque membre actif
// (sauf ceux qui ont désactivé le rappel dans Paramètres) via l'API Brevo.
// Déclenchée par pg_cron (voir migration 202609200005) avec l'en-tête `x-digest-secret`.
// À déployer sans vérification de JWT : `supabase functions deploy daily-digest --no-verify-jwt`.
//
// Secrets attendus (Edge Functions → Secrets) :
//   DIGEST_CRON_SECRET  — même valeur que `digest_cron_secret` dans Vault
//   BREVO_API_KEY       — clé API Brevo (xkeysib-…)
//   DIGEST_FROM_EMAIL   — adresse d'expédition validée dans Brevo
//   DIGEST_FROM_NAME    — optionnel, défaut « Dovozo clients »
//   CRM_URL             — optionnel, défaut https://addictshoppeuse.github.io/crm-client/
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { json } from '../_shared/authorization.ts'

const TIME_ZONE = 'Europe/Paris'
const SEND_HOUR = 10
const CLOSED_STATUSES = new Set(['Gagné', 'Perdu'])

type Prospect = {
  id: string
  organization_id: string
  company: string
  contact_name: string
  status: string
  priority: string
  reminder_date: string | null
  followup_date: string | null
  next_meeting: string | null
}

function parisDate(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function parisHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(new Date()))
}

function formatFr(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function nextReminder(p: Prospect) {
  return p.reminder_date || p.followup_date || null
}

function buildEmail(name: string, today: string, dueToday: Prospect[], overdue: Prospect[], meetings: Prospect[], crmUrl: string) {
  const line = (p: Prospect, date: string | null) =>
    `<li style="margin:0 0 6px"><strong>${escapeHtml(p.company)}</strong>${p.contact_name ? ` — ${escapeHtml(p.contact_name)}` : ''}${date ? ` <span style="color:#6b7280">(${formatFr(date)})</span>` : ''}</li>`
  const section = (title: string, color: string, items: string[]) =>
    items.length ? `<h3 style="margin:22px 0 8px;font-size:15px;color:${color}">${title} (${items.length})</h3><ul style="margin:0;padding-left:18px">${items.join('')}</ul>` : ''
  const nothing = !dueToday.length && !overdue.length && !meetings.length
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : 'Bonjour,'
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#171a21;max-width:560px;margin:0 auto;padding:24px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#41277C;font-weight:700">Dovozo clients</p>
  <h2 style="margin:0 0 16px;font-size:20px">Vos relances du ${formatFr(today)}</h2>
  <p>${greeting}</p>
  ${nothing ? '<p>Rien de prévu aujourd’hui et aucune relance en retard. Bonne journée !</p>' : ''}
  ${section('Relances du jour', '#1f7a4d', dueToday.map(p => line(p, null)))}
  ${section('Appels / rendez-vous du jour', '#1d4ed8', meetings.map(p => line(p, null)))}
  ${section('En retard', '#9a2525', overdue.map(p => line(p, nextReminder(p))))}
  <p style="margin:26px 0 0"><a href="${crmUrl}" style="display:inline-block;background:#41277C;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:700">Ouvrir le CRM</a></p>
  <p style="margin:22px 0 0;font-size:12px;color:#6b7280">Vous recevez ce rappel chaque matin à 10 h. Pour l’arrêter : Paramètres → Rappel quotidien dans le CRM.</p>
</div>`
  const text = [
    `Vos relances du ${formatFr(today)}`,
    '',
    dueToday.length ? `Relances du jour (${dueToday.length}) :\n${dueToday.map(p => `- ${p.company}${p.contact_name ? ' — ' + p.contact_name : ''}`).join('\n')}` : '',
    meetings.length ? `Appels / rendez-vous du jour (${meetings.length}) :\n${meetings.map(p => `- ${p.company}`).join('\n')}` : '',
    overdue.length ? `En retard (${overdue.length}) :\n${overdue.map(p => `- ${p.company} (${formatFr(nextReminder(p) || today)})`).join('\n')}` : '',
    nothing ? 'Rien de prévu aujourd’hui et aucune relance en retard.' : '',
    '',
    `Ouvrir le CRM : ${crmUrl}`,
  ].filter(Boolean).join('\n')
  const subject = nothing
    ? `Dovozo clients — rien à relancer aujourd’hui`
    : `Dovozo clients — ${dueToday.length + meetings.length} aujourd’hui, ${overdue.length} en retard`
  return { subject, html, text }
}

async function sendBrevo(apiKey: string, from: { email: string; name: string }, to: { email: string; name: string }, message: { subject: string; html: string; text: string }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: from, to: [to], subject: message.subject, htmlContent: message.html, textContent: message.text }),
  })
  if (!response.ok) throw new Error(`Brevo ${response.status}: ${(await response.text()).slice(0, 300)}`)
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const expected = Deno.env.get('DIGEST_CRON_SECRET') || ''
  const provided = req.headers.get('x-digest-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => ({})) as { force?: boolean; dryRun?: boolean }
  const hour = parisHour()
  if (!body.force && hour !== SEND_HOUR) return json({ skipped: true, reason: `Il est ${hour} h à Paris, envoi prévu à ${SEND_HOUR} h` })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const brevoKey = Deno.env.get('BREVO_API_KEY')
  const fromEmail = Deno.env.get('DIGEST_FROM_EMAIL')
  if (!url || !serviceKey) return json({ error: 'Server configuration unavailable' }, 500)
  if (!body.dryRun && (!brevoKey || !fromEmail)) return json({ error: 'BREVO_API_KEY ou DIGEST_FROM_EMAIL manquant' }, 500)
  const from = { email: fromEmail || 'noreply@example.com', name: Deno.env.get('DIGEST_FROM_NAME') || 'Dovozo clients' }
  const crmUrl = Deno.env.get('CRM_URL') || 'https://addictshoppeuse.github.io/crm-client/'

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const today = parisDate(new Date())!
  const [members, prospects, preferences] = await Promise.all([
    admin.from('memberships').select('user_id,organization_id,display_name,email,state').eq('state', 'active'),
    admin.from('prospects').select('id,organization_id,company,contact_name,status,priority,reminder_date,followup_date,next_meeting'),
    admin.from('user_preferences').select('user_id,organization_id,daily_digest'),
  ])
  if (members.error) throw members.error
  if (prospects.error) throw prospects.error
  if (preferences.error) throw preferences.error

  const optedOut = new Set((preferences.data || []).filter(p => p.daily_digest === false).map(p => `${p.organization_id}:${p.user_id}`))
  const byOrg = new Map<string, Prospect[]>()
  for (const p of (prospects.data || []) as Prospect[]) {
    if (CLOSED_STATUSES.has(p.status)) continue
    if (!byOrg.has(p.organization_id)) byOrg.set(p.organization_id, [])
    byOrg.get(p.organization_id)!.push(p)
  }

  const results: Array<{ email: string; status: string }> = []
  for (const member of members.data || []) {
    if (optedOut.has(`${member.organization_id}:${member.user_id}`)) { results.push({ email: member.email || member.user_id, status: 'désactivé' }); continue }
    let email = member.email
    if (!email) {
      const { data } = await admin.auth.admin.getUserById(member.user_id)
      email = data?.user?.email || ''
    }
    if (!email) { results.push({ email: member.user_id, status: 'sans email' }); continue }

    const rows = byOrg.get(member.organization_id) || []
    const dueToday = rows.filter(p => nextReminder(p) === today)
    const overdue = rows.filter(p => { const d = nextReminder(p); return Boolean(d && d < today) })
      .sort((a, b) => String(nextReminder(a)).localeCompare(String(nextReminder(b))))
    const meetings = rows.filter(p => parisDate(p.next_meeting) === today)
    const message = buildEmail(member.display_name, today, dueToday, overdue, meetings, crmUrl)
    if (body.dryRun) { results.push({ email, status: `simulation : ${message.subject}` }); continue }
    try {
      await sendBrevo(brevoKey!, from, { email, name: member.display_name || email }, message)
      results.push({ email, status: 'envoyé' })
    } catch (error) {
      console.error('daily-digest', email, error)
      results.push({ email, status: 'échec' })
    }
  }
  return json({ date: today, hour, sent: results.filter(r => r.status === 'envoyé').length, results })
})
