// Flux iCal (.ics) des relances, rendez-vous et fins de contrat d'une organisation, pour abonnement
// dans Google Agenda / Apple Calendrier / Outlook. Lecture seule, sens unique CRM → agenda.
// URL : GET /functions/v1/calendar-feed?token=<jeton personnel> (jeton créé dans le CRM, Paramètres → Agenda).
// À déployer sans vérification de JWT : `supabase functions deploy calendar-feed --no-verify-jwt`.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const CLOSED_STATUSES = new Set(['Gagné', 'Perdu'])
const CRM_URL = Deno.env.get('CRM_URL') || 'https://addictshoppeuse.github.io/crm-client/'

type Prospect = {
  id: string; company: string; contact_name: string; contact_role: string; phone: string; email: string; status: string
  reminder_date: string | null; followup_date: string | null; next_meeting: string | null; contract_end: string | null
  notes: string | null; updated_at: string
}

function icsText(value: string) {
  const backslash = String.fromCharCode(92)
  return String(value || '')
    .split(backslash).join(backslash + backslash)
    .replace(/\r?\n/g, backslash + 'n')
    .replace(/[;,]/g, m => backslash + m)
}
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74) }
  out.push(rest)
  return out.join('\r\n')
}
function dateBasic(iso: string) { return iso.slice(0, 10).replace(/-/g, '') }
function nextDay(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}
function stampUtc(value: string | Date) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function event(uid: string, summary: string, p: Prospect, opts: { allDay?: string; start?: string; kind: string }) {
  const desc = [
    p.contact_name ? `Contact : ${p.contact_name}${p.contact_role ? ' — ' + p.contact_role : ''}` : '',
    p.phone ? `Téléphone : ${p.phone}` : '',
    p.email ? `Email : ${p.email}` : '',
    `Statut : ${p.status}`,
    p.notes ? `Notes : ${p.notes}` : '',
    `Ouvrir le CRM : ${CRM_URL}`,
  ].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}@dovozo-clients`,
    `DTSTAMP:${stampUtc(p.updated_at || new Date())}`,
    `SUMMARY:${icsText(summary)}`,
    `DESCRIPTION:${icsText(desc)}`,
    `CATEGORIES:${icsText(opts.kind)}`,
    `URL:${CRM_URL}`,
  ]
  if (opts.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateBasic(opts.allDay)}`, `DTEND;VALUE=DATE:${nextDay(opts.allDay)}`)
  } else if (opts.start) {
    const start = new Date(opts.start)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    lines.push(`DTSTART:${stampUtc(start)}`, `DTEND:${stampUtc(end)}`)
  }
  lines.push('END:VEVENT')
  return lines.map(fold).join('\r\n')
}

Deno.serve(async req => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return new Response('Lien invalide', { status: 403 })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return new Response('Configuration indisponible', { status: 500 })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: pref } = await admin.from('user_preferences').select('user_id,organization_id').eq('calendar_token', token).maybeSingle()
  if (!pref) return new Response('Lien invalide ou révoqué', { status: 403 })
  const { data: membership } = await admin.from('memberships').select('state').eq('user_id', pref.user_id).eq('organization_id', pref.organization_id).maybeSingle()
  if (!membership || membership.state !== 'active') return new Response('Accès désactivé', { status: 403 })

  const { data: rows, error } = await admin.from('prospects')
    .select('id,company,contact_name,contact_role,phone,email,status,reminder_date,followup_date,next_meeting,contract_end,notes,updated_at')
    .eq('organization_id', pref.organization_id)
  if (error) return new Response('Erreur de lecture', { status: 500 })

  const events: string[] = []
  for (const p of (rows || []) as Prospect[]) {
    const active = !CLOSED_STATUSES.has(p.status)
    const reminder = p.reminder_date || p.followup_date
    if (active && reminder) events.push(event(`relance-${p.id}`, `Relance : ${p.company}`, p, { allDay: reminder, kind: 'Relance' }))
    if (active && p.next_meeting) events.push(event(`rdv-${p.id}`, `RDV : ${p.company}`, p, { start: p.next_meeting, kind: 'Rendez-vous' }))
    if (p.contract_end) events.push(event(`contrat-${p.id}`, `Fin de contrat : ${p.company}`, p, { allDay: p.contract_end, kind: 'Fin de contrat' }))
  }
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dovozo clients//CRM//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Dovozo clients', 'X-WR-TIMEZONE:Europe/Paris', 'X-PUBLISHED-TTL:PT1H',
    ...events, 'END:VCALENDAR', '',
  ].join('\r\n')
  return new Response(body, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="dovozo-clients.ics"', 'Cache-Control': 'private, max-age=300', 'Access-Control-Allow-Origin': '*' },
  })
})
