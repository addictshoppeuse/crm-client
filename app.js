import {
  STATUSES,
  STATUS_META,
  countByStatus,
  filterProspects,
  getDueReminders,
  nextReminderDate,
  formatDateFr,
  formatLongDateFr,
  sortProspects,
  initials,
  todayIso,
  makeId,
} from './lib/domain.mjs'

const app = document.querySelector('#app')
const CONFIG = window.CRM_CONFIG || {}
const HAS_CONFIG = Boolean(
  String(CONFIG.supabaseUrl || '').startsWith('https://') &&
  String(CONFIG.supabasePublishableKey || '').trim()
)

const state = {
  backend: HAS_CONFIG ? 'supabase' : 'demo',
  supabase: null,
  session: null,
  prospects: [],
  profiles: [],
  view: 'dashboard',
  query: '',
  statusFilter: 'Tous',
  selectedId: null,
  sortKey: 'source_order',
  sortDirection: 'asc',
  filterOpen: false,
  userMenuOpen: false,
  editor: null,
  timeline: [],
  authMode: 'login',
  authMessage: '',
  loading: true,
  realtimeChannel: null,
  demoActivities: [],
  demoHistory: [],
}

const SVG = {
  home: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  pipeline: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20V8"/></svg>',
  calendar: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  user: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.4-6 8-6s7.2 1.8 8 6"/></svg>',
  phone: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-3 2a15 15 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2C9 21 3 15 3 6c0-1 1-2 2-2Z"/></svg>',
  refresh: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 11.9-3"/></svg>',
  document: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></svg>',
  trophy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M6 5H3v2c0 3 2 5 5 5M18 5h3v2c0 3-2 5-5 5M12 12v5M8 21h8M10 17h4"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 5 14 14M19 5 5 19"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.6-4 2.5-6 6-6s5.4 2 6 6M15 15c3.3 0 5.3 1.6 6 5"/></svg>',
  filter: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16l-6 7v6l-4 2v-8z"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  mail: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
  save: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 17h8"/></svg>',
  send: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-8-8 18-2-7z"/><path d="m11 14 4-4"/></svg>',
  chevron: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 9 5 5 5-5"/></svg>',
  dots: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 16-1 5 5-1L19 9l-4-4z"/><path d="m13 7 4 4"/></svg>',
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function attr(value) { return esc(value) }
function selected(a, b) { return a === b ? ' selected' : '' }
function checked(v) { return v ? ' checked' : '' }

function statusStyle(status) {
  const meta = STATUS_META[status] || { bg: '#f0f1f3', text: '#414854' }
  return `background:${meta.bg};color:${meta.text};border-color:${meta.bg}`
}

function statusOptions(current) {
  return STATUSES.map(status => `<option value="${attr(status)}"${selected(status, current)}>${esc(status)}</option>`).join('')
}

function profileOptions(current) {
  const options = ['<option value="">Non attribué</option>']
  for (const profile of state.profiles) {
    options.push(`<option value="${attr(profile.id)}"${selected(profile.id, current || '')}>${esc(profile.full_name || profile.email || 'Utilisateur')}</option>`)
  }
  return options.join('')
}

function getSelected() {
  return state.prospects.find(p => p.id === state.selectedId) || null
}

function userDisplayName() {
  if (state.backend === 'demo') return ''
  const id = state.session?.user?.id
  const profile = state.profiles.find(p => p.id === id)
  const raw = profile?.full_name || state.session?.user?.user_metadata?.full_name || state.session?.user?.email?.split('@')[0] || ''
  if (!raw || raw === 'demo') return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function greetingTitle() {
  const name = userDisplayName()
  return name ? `Bonjour ${esc(name)} !` : 'Bonjour !'
}

function toast(message, error = false) {
  let zone = document.querySelector('.toast-zone')
  if (!zone) {
    zone = document.createElement('div')
    zone.className = 'toast-zone'
    document.body.appendChild(zone)
  }
  const item = document.createElement('div')
  item.className = `toast${error ? ' error' : ''}`
  item.textContent = message
  zone.appendChild(item)
  setTimeout(() => item.remove(), 3200)
}

async function loadDemo() {
  const saved = localStorage.getItem('crm-prospection-demo-v2')
  if (saved) {
    try { state.prospects = JSON.parse(saved) } catch { localStorage.removeItem('crm-prospection-demo-v2') }
  }
  if (!state.prospects.length) {
    state.prospects = []
  }
  state.profiles = []
  state.session = { user: { id: 'demo-user', email: '', user_metadata: { full_name: '' } } }
  state.selectedId = state.prospects[0]?.id || null
  state.loading = false
}

function persistDemo() {
  if (state.backend === 'demo') localStorage.setItem('crm-prospection-demo-v2', JSON.stringify(state.prospects))
}

async function initSupabase() {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm')
    state.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey)
    const { data, error } = await state.supabase.auth.getSession()
    if (error) throw error
    state.session = data.session
    state.supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session
      state.authMessage = ''
      if (session) await loadRemote()
      else clearRealtime()
      render()
    })
    if (state.session) await loadRemote()
    state.loading = false
  } catch (error) {
    console.error(error)
    state.backend = 'demo'
    await loadDemo()
    toast('Connexion Supabase indisponible : ouverture en stockage local.', true)
  }
}

function clearRealtime() {
  if (state.supabase && state.realtimeChannel) state.supabase.removeChannel(state.realtimeChannel)
  state.realtimeChannel = null
}

async function loadRemote() {
  if (!state.supabase || !state.session) return
  const [prospectsResult, profilesResult] = await Promise.all([
    state.supabase.from('prospects').select('*').order('source_order', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false }),
    state.supabase.from('profiles').select('id,full_name,role').order('full_name'),
  ])
  if (prospectsResult.error) throw prospectsResult.error
  if (profilesResult.error) console.warn(profilesResult.error)
  state.prospects = prospectsResult.data || []
  state.profiles = profilesResult.data || []
  if (!state.selectedId || !state.prospects.some(p => p.id === state.selectedId)) {
    state.selectedId = state.prospects[0]?.id || null
  }
  if (!state.realtimeChannel) {
    state.realtimeChannel = state.supabase.channel('crm-prospects-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, async () => {
        try { await loadRemote(); render() } catch (error) { console.error(error) }
      })
      .subscribe()
  }
}

async function updateProspect(id, payload, { silent = false } = {}) {
  if (state.backend === 'demo') {
    const index = state.prospects.findIndex(p => p.id === id)
    if (index < 0) return
    const previous = state.prospects[index]
    const next = { ...previous, ...payload, updated_at: new Date().toISOString() }
    state.prospects[index] = next
    if (payload.status && payload.status !== previous.status) {
      state.demoHistory.unshift({
        id: makeId(), prospect_id: id, user_id: 'demo-user',
        from_status: previous.status, to_status: payload.status, changed_at: new Date().toISOString(),
      })
    }
    persistDemo()
  } else {
    const { error } = await state.supabase.from('prospects').update(payload).eq('id', id)
    if (error) throw error
    await loadRemote()
  }
  if (!silent) toast('Prospect mis à jour.')
}

async function createProspect(payload) {
  if (state.backend === 'demo') {
    const row = {
      id: makeId(), source_order: Math.max(0, ...state.prospects.map(p => Number(p.source_order) || 0)) + 1, ...payload,
      status: payload.status || 'Identifié', priority: payload.priority || 'Normale',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    state.prospects.unshift(row)
    state.selectedId = row.id
    state.demoHistory.unshift({ id: makeId(), prospect_id: row.id, user_id: 'demo-user', from_status: null, to_status: row.status, changed_at: new Date().toISOString() })
    persistDemo()
  } else {
    const source_order = Math.max(0, ...state.prospects.map(p => Number(p.source_order) || 0)) + 1
    const { data, error } = await state.supabase.from('prospects').insert({ ...payload, source_order }).select('*').single()
    if (error) throw error
    state.selectedId = data.id
    await loadRemote()
  }
  toast('Prospect ajouté.')
}

async function deleteProspect(id) {
  const prospect = state.prospects.find(p => p.id === id)
  if (!prospect || !confirm(`Supprimer ${prospect.company} ?`)) return
  if (state.backend === 'demo') {
    state.prospects = state.prospects.filter(p => p.id !== id)
    persistDemo()
  } else {
    const { error } = await state.supabase.from('prospects').delete().eq('id', id)
    if (error) throw error
    await loadRemote()
  }
  state.selectedId = state.prospects[0]?.id || null
  state.editor = null
  toast('Prospect supprimé.')
  render()
}

async function addActivity(prospectId, activityType, note) {
  if (!note.trim()) return
  if (state.backend === 'demo') {
    state.demoActivities.unshift({ id: makeId(), prospect_id: prospectId, user_id: 'demo-user', activity_type: activityType, note: note.trim(), happened_at: new Date().toISOString() })
  } else {
    const { error } = await state.supabase.from('activities').insert({ prospect_id: prospectId, activity_type: activityType, note: note.trim() })
    if (error) throw error
  }
  await loadTimeline(prospectId)
  toast('Action ajoutée à l’historique.')
}

async function loadTimeline(prospectId) {
  if (!prospectId) { state.timeline = []; return }
  let activities = []
  let history = []
  if (state.backend === 'demo') {
    activities = state.demoActivities.filter(x => x.prospect_id === prospectId)
    history = state.demoHistory.filter(x => x.prospect_id === prospectId)
  } else {
    const [a, h] = await Promise.all([
      state.supabase.from('activities').select('*').eq('prospect_id', prospectId).order('happened_at', { ascending: false }),
      state.supabase.from('status_history').select('*').eq('prospect_id', prospectId).order('changed_at', { ascending: false }),
    ])
    activities = a.data || []
    history = h.data || []
  }
  state.timeline = [
    ...activities.map(x => ({ id: `a-${x.id}`, at: x.happened_at, text: `${x.activity_type}${x.note ? ` — ${x.note}` : ''}` })),
    ...history.map(x => ({ id: `h-${x.id}`, at: x.changed_at, text: `Statut : ${x.from_status || 'création'} → ${x.to_status}` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))
}

function renderAuth() {
  const login = state.authMode === 'login'
  const palette = STATUSES.map(status => `<span style="background:${STATUS_META[status].bg}"></span>`).join('')
  return `
    <main class="auth-page">
      <section class="auth-visual">
        <div class="auth-brand"><img src="./assets/logo.svg" alt="" /> CRM Prospection</div>
        <div class="auth-copy"><h1>Votre prospection, enfin au même endroit.</h1><p>Pipeline partagé, relances, historique et suivi des prospects — avec les codes couleur de votre fichier Excel.</p></div>
        <div class="auth-palette" aria-hidden="true">${palette}</div>
      </section>
      <section class="auth-card-wrap">
        <div class="auth-card">
          <h2>${login ? 'Se connecter' : 'Créer un compte'}</h2>
          <p>${login ? 'Accédez au pipeline partagé de votre équipe.' : 'Créez votre accès au CRM.'}</p>
          <form class="auth-form" data-form="auth">
            <label class="field"><span>Email</span><input class="text-input" name="email" type="email" autocomplete="email" required placeholder="vous@entreprise.fr" /></label>
            <label class="field"><span>Mot de passe</span><input class="text-input" name="password" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" minlength="6" required /></label>
            ${state.authMessage ? `<div class="auth-message">${esc(state.authMessage)}</div>` : ''}
            <button class="btn btn-dark" type="submit">${login ? 'Se connecter' : 'Créer le compte'}</button>
          </form>
          <button class="auth-switch" type="button" data-action="toggle-auth">${login ? 'Créer un compte' : 'J’ai déjà un compte'}</button>
        </div>
      </section>
    </main>`
}

function kpiCard(label, value, status = null, icon = '') {
  const total = state.prospects.length || 1
  const pct = status ? Math.round((value / total) * 100) : null
  const style = status ? statusStyle(status) : ''
  const hint = status ? `${pct} % du total` : 'prospects dans votre CRM'
  return `<article class="kpi-card${status ? '' : ' total'}" style="${style}">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-icon">${icon}</div>
    <div class="kpi-number">${value}</div>
    <div class="kpi-hint">${hint}</div>
  </article>`
}

function renderKpis() {
  const counts = countByStatus(state.prospects)
  return `<div class="kpi-scroller"><section class="kpi-grid" aria-label="Indicateurs pipeline">
    ${kpiCard('Total', state.prospects.length, null, SVG.users)}
    ${kpiCard('Identifiés', counts['Identifié'], 'Identifié', SVG.user)}
    ${kpiCard('Contactés', counts['Contacté'], 'Contacté', SVG.phone)}
    ${kpiCard('Relancés', counts['Relancé'], 'Relancé', SVG.refresh)}
    ${kpiCard('Calls prévus', counts['Call prévu'], 'Call prévu', SVG.calendar)}
    ${kpiCard('Propositions', counts['Proposition'], 'Proposition', SVG.document)}
    ${kpiCard('Gagnés', counts['Gagné'], 'Gagné', SVG.trophy)}
    ${kpiCard('Perdus', counts['Perdu'], 'Perdu', SVG.x)}
    ${kpiCard('À recontacter', counts['À recontacter'], 'À recontacter', SVG.clock)}
  </section></div>`
}

function getVisibleProspects() {
  return sortProspects(filterProspects(state.prospects, state.query, state.statusFilter), state.sortKey, state.sortDirection)
}

function sortHeader(label, key) {
  const active = state.sortKey === key
  const arrow = active ? (state.sortDirection === 'asc' ? '↑' : '↓') : '↕'
  return `<button class="sort-button" type="button" data-action="sort" data-key="${key}">${esc(label)} <span class="sort-glyph">${arrow}</span></button>`
}

function renderProspectRows(rows) {
  if (!rows.length) return `<tr><td colspan="9"><div class="empty-table">Aucun prospect ne correspond à votre recherche.</div></td></tr>`
  return rows.map(prospect => {
    const isSelected = prospect.id === state.selectedId
    const email = prospect.email || 'Email à compléter'
    return `<tr class="${isSelected ? 'selected' : ''}" data-action="select-prospect" data-id="${attr(prospect.id)}">
      <td class="checkbox-cell"><span class="fake-check" aria-hidden="true"></span></td>
      <td class="company-cell"><div class="company-lockup"><span class="company-mark">${esc(initials(prospect.company))}</span><span>${esc(prospect.company)}</span></div></td>
      <td><span class="contact-main">${esc(prospect.contact_name || 'Contact à compléter')}</span><span class="contact-sub">${esc(email)}</span></td>
      <td><span class="status-chip" style="${statusStyle(prospect.status)}">${esc(prospect.status)}</span></td>
      <td>${formatDateFr(prospect.contact_date)}</td>
      <td>${formatDateFr(prospect.followup_date)}</td>
      <td>${formatDateFr(prospect.reminder_date)}</td>
      <td><span class="notes-preview" title="${attr(prospect.notes || '')}">${esc(prospect.notes || '—')}</span></td>
      <td><button type="button" class="row-menu" data-action="edit-prospect" data-id="${attr(prospect.id)}" aria-label="Modifier ${attr(prospect.company)}">${SVG.dots}</button></td>
    </tr>`
  }).join('')
}

function renderListPanel({ title = 'Liste des prospects', rows = getVisibleProspects() } = {}) {
  return `<section class="panel list-panel">
    <div class="list-toolbar">
      <div class="list-title"><h2>${esc(title)}</h2><span class="result-pill">${rows.length} résultat${rows.length > 1 ? 's' : ''}</span></div>
      <div class="list-search-wrap">${SVG.search}<input class="list-search" data-search="list" value="${attr(state.query)}" placeholder="Rechercher une entreprise…" aria-label="Rechercher" /></div>
      <div class="filter-wrap">
        <button class="btn" type="button" data-action="toggle-filter">${SVG.filter}<span class="desktop-label">Filtres</span></button>
        ${state.filterOpen ? `<div class="filter-popover"><label>Statut<select class="select-input" data-change="status-filter"><option value="Tous"${selected(state.statusFilter,'Tous')}>Tous les statuts</option>${statusOptions(state.statusFilter)}</select></label></div>` : ''}
      </div>
      <button class="btn btn-dark" type="button" data-action="add-prospect">${SVG.plus}<span class="desktop-label">Ajouter un prospect</span></button>
    </div>
    <div class="table-scroll">
      <table class="prospect-table">
        <thead><tr><th class="checkbox-cell"><span class="fake-check" aria-hidden="true"></span></th><th>${sortHeader('Entreprise','company')}</th><th>${sortHeader('Contact','contact_name')}</th><th>${sortHeader('Statut','status')}</th><th>${sortHeader('Date contact','contact_date')}</th><th>${sortHeader('Date relance','followup_date')}</th><th>${sortHeader('Date de rappel','reminder_date')}</th><th>Notes</th><th></th></tr></thead>
        <tbody>${renderProspectRows(rows)}</tbody>
      </table>
    </div>
  </section>`
}

function renderDetailPanel(prospect = getSelected()) {
  if (!prospect) return `<aside class="panel detail-panel"><div class="detail-placeholder"><div><div class="detail-placeholder-icon">${SVG.user}</div><h3>Sélectionnez un prospect</h3><p>Cliquez sur une ligne du tableau pour afficher sa fiche et planifier la prochaine action.</p></div></div></aside>`
  const meta = STATUS_META[prospect.status] || STATUS_META['Identifié']
  return `<aside class="panel detail-panel">
    <div class="detail-head"><h2>Fiche prospect</h2><button type="button" class="close-detail" data-action="close-detail" aria-label="Fermer">×</button></div>
    <div class="detail-company">
      <div class="detail-logo">${esc(initials(prospect.company))}</div>
      <div><h3>${esc(prospect.company)}</h3><p>${esc(prospect.contact_name || 'Contact à compléter')}</p></div>
    </div>
    <div class="detail-section no-border">
      <div class="detail-label">${SVG.user} Contact principal</div>
      <div class="contact-grid"><div class="contact-name">${esc(prospect.contact_name || 'À compléter')}</div>${prospect.email ? `<a class="contact-email" href="mailto:${attr(prospect.email.split(/[ /]/)[0])}">${SVG.mail} ${esc(prospect.email)}</a>` : '<span class="contact-email">Email à compléter</span>'}</div>
    </div>
    <form class="detail-form detail-section" data-form="quick-save" data-id="${attr(prospect.id)}">
      <div class="detail-field"><label for="quick-status">Statut</label><div class="status-select-wrap"><select id="quick-status" name="status" style="background:${meta.bg};color:${meta.text};border-color:${meta.bg};font-weight:750" data-change="quick-status" data-id="${attr(prospect.id)}">${statusOptions(prospect.status)}</select><span class="select-chevron">${SVG.chevron}</span></div></div>
      <div class="detail-field"><label>Responsable</label><select name="owner_id">${profileOptions(prospect.owner_id)}</select></div>
      <div class="detail-field"><label>Concurrent</label><input name="competitor" value="${attr(prospect.competitor || '')}" placeholder="Nom du concurrent" /></div>
      <div class="two-col">
        <div class="detail-field"><label>Fin de contrat concurrent</label><input type="date" name="contract_end" value="${attr(prospect.contract_end || '')}" /></div>
        <div class="detail-field"><label>Prochain rappel</label><input type="date" name="reminder_date" id="quick-reminder-date" value="${attr(prospect.reminder_date || '')}" /></div>
      </div>
      <div class="detail-field"><label>Notes</label><textarea name="notes">${esc(prospect.notes || '')}</textarea></div>
      <div class="detail-actions"><button class="btn btn-dark" type="button" data-action="plan-reminder">${SVG.send} Planifier une relance</button><button class="btn" type="submit">${SVG.save} Enregistrer</button><button class="btn btn-icon" type="button" data-action="edit-prospect" data-id="${attr(prospect.id)}" aria-label="Modifier la fiche complète">${SVG.dots}</button></div>
    </form>
  </aside>`
}

function renderDashboard() {
  const rows = getVisibleProspects()
  return `${renderKpis()}<div class="workspace">${renderListPanel({ rows })}${renderDetailPanel()}</div>`
}

function renderPipeline() {
  const filtered = filterProspects(state.prospects, state.query, 'Tous')
  const counts = countByStatus(filtered)
  return `${renderKpis()}<section class="panel kanban-panel">
    <div class="kanban-toolbar"><div><h2>Pipeline commercial</h2><div class="result-pill" style="display:inline-block;margin-top:6px">${filtered.length} prospect${filtered.length > 1 ? 's' : ''}</div></div><button class="btn btn-dark" type="button" data-action="add-prospect">${SVG.plus} Ajouter un prospect</button></div>
    <div class="kanban-scroll"><div class="kanban">${STATUSES.map(status => {
      const cards = filtered.filter(p => p.status === status)
      return `<div class="kanban-column"><div class="kanban-column-head" style="${statusStyle(status)}"><span>${esc(status)}</span><span>${counts[status]}</span></div>${cards.map(p => `<button class="kanban-card" type="button" data-action="pipeline-select" data-id="${attr(p.id)}"><strong>${esc(p.company)}</strong><span>${esc(p.contact_name || 'Contact à compléter')}</span><span>${formatDateFr(nextReminderDate(p))}</span></button>`).join('') || '<div class="empty-table" style="padding:24px 6px">Aucun prospect</div>'}</div>`
    }).join('')}</div></div>
  </section>`
}

function renderReminders() {
  const today = todayIso()
  const due = getDueReminders(filterProspects(state.prospects, state.query, 'Tous'), today)
  const overdue = due.filter(p => nextReminderDate(p) < today).length
  const todayCount = due.filter(p => nextReminderDate(p) === today).length
  const rows = sortProspects(due, 'reminder_date', 'asc')
  return `<section class="reminder-summary"><div class="mini-card"><span>À traiter</span><strong>${due.length}</strong></div><div class="mini-card"><span>En retard</span><strong class="overdue">${overdue}</strong></div><div class="mini-card"><span>Aujourd’hui</span><strong class="today">${todayCount}</strong></div></section><div class="workspace">${renderListPanel({ title: 'Relances à traiter', rows })}${renderDetailPanel()}</div>`
}

function renderAppShell() {
  const dueCount = getDueReminders(state.prospects, todayIso()).length
  const name = userDisplayName()
  const initialsValue = initials(name || state.session?.user?.email || 'U')
  const content = state.view === 'pipeline' ? renderPipeline() : state.view === 'reminders' ? renderReminders() : renderDashboard()
  return `<header class="app-topbar">
      <div class="top-brand"><img src="./assets/logo.svg" alt="" /><span>CRM Prospection</span></div>
      <nav class="top-nav" aria-label="Navigation principale">
        <button type="button" class="nav-btn ${state.view === 'dashboard' ? 'active' : ''}" data-action="nav" data-view="dashboard">${SVG.home}<span class="nav-label">Tableau de bord</span></button>
        <button type="button" class="nav-btn ${state.view === 'pipeline' ? 'active' : ''}" data-action="nav" data-view="pipeline">${SVG.pipeline}<span class="nav-label">Pipeline</span></button>
        <button type="button" class="nav-btn ${state.view === 'reminders' ? 'active' : ''}" data-action="nav" data-view="reminders">${SVG.calendar}<span class="nav-label">Relances</span>${dueCount ? `<span class="nav-count">${dueCount}</span>` : ''}</button>
      </nav>
      <div class="top-spacer"></div>
      ${state.backend === 'demo' ? '<span class="demo-pill">Stockage local</span>' : ''}
      <div class="top-search-wrap">${SVG.search}<input class="top-search" data-search="top" value="${attr(state.query)}" placeholder="Rechercher une entreprise, un contact…" aria-label="Recherche globale" /></div>
      <div class="user-menu"><button class="user-button" type="button" data-action="toggle-user"><span class="avatar">${esc(initialsValue)}</span><span class="user-name">${esc(name || state.session?.user?.email || 'Utilisateur')}</span>${SVG.chevron}</button>${state.userMenuOpen ? `<div class="user-popover"><div class="menu-row">${esc(state.session?.user?.email || 'Stockage local')}</div>${state.backend === 'demo' ? '<button type="button" data-action="reset-demo">Réinitialiser les données locales</button>' : '<button type="button" data-action="logout">Se déconnecter</button>'}</div>` : ''}</div>
    </header>
    <main class="page">
      <div class="page-head"><div><h1>${greetingTitle()}</h1><p>Voici un aperçu de votre prospection commerciale.</p></div><div class="current-date">${esc(formatLongDateFr())}</div></div>
      ${content}
    </main>
    ${state.editor ? renderEditor() : ''}`
  return content
}

function editorProspect() {
  if (!state.editor?.id) return null
  return state.prospects.find(p => p.id === state.editor.id) || null
}

function renderEditor() {
  const p = editorProspect()
  const creating = !p
  const values = p || {
    company: '', contact_name: '', email: '', status: 'Identifié', owner_id: '',
    contact_date: '', followup_date: '', next_meeting: '', competitor: '', contract_end: '', reminder_date: '', priority: 'Normale', notes: '',
  }
  return `<div class="modal-layer" data-action="modal-backdrop">
    <section class="modal" role="dialog" aria-modal="true" aria-label="${creating ? 'Ajouter un prospect' : 'Modifier le prospect'}">
      <div class="modal-head"><div><div class="eyebrow">${creating ? 'Nouveau prospect' : 'Fiche complète'}</div><h2>${creating ? 'Ajouter une entreprise' : esc(p.company)}</h2></div><button class="btn btn-icon" type="button" data-action="close-editor">×</button></div>
      <div class="modal-body">
        <form data-form="editor" data-id="${creating ? '' : attr(p.id)}">
          <div class="form-grid">
            <label class="field span-2"><span>Entreprise</span><input class="text-input" name="company" value="${attr(values.company)}" required /></label>
            <label class="field"><span>Contact</span><input class="text-input" name="contact_name" value="${attr(values.contact_name || '')}" /></label>
            <label class="field"><span>Email</span><input class="text-input" name="email" value="${attr(values.email || '')}" /></label>
            <label class="field"><span>Statut</span><select class="select-input" name="status">${statusOptions(values.status)}</select></label>
            <label class="field"><span>Responsable</span><select class="select-input" name="owner_id">${profileOptions(values.owner_id)}</select></label>
            <label class="field"><span>Date de contact</span><input class="text-input" type="date" name="contact_date" value="${attr(values.contact_date || '')}" /></label>
            <label class="field"><span>Date de relance</span><input class="text-input" type="date" name="followup_date" value="${attr(values.followup_date || '')}" /></label>
            <label class="field"><span>Prochain RDV</span><input class="text-input" type="date" name="next_meeting" value="${attr(values.next_meeting || '')}" /></label>
            <label class="field"><span>Date de rappel</span><input class="text-input" type="date" name="reminder_date" value="${attr(values.reminder_date || '')}" /></label>
            <label class="field"><span>Concurrent</span><input class="text-input" name="competitor" value="${attr(values.competitor || '')}" /></label>
            <label class="field"><span>Fin de contrat concurrent</span><input class="text-input" type="date" name="contract_end" value="${attr(values.contract_end || '')}" /></label>
            <label class="field"><span>Priorité</span><select class="select-input" name="priority">${['Basse','Normale','Haute','Urgente'].map(x => `<option${selected(x, values.priority || 'Normale')}>${x}</option>`).join('')}</select></label>
            <label class="field span-2"><span>Notes</span><textarea class="textarea-input" name="notes">${esc(values.notes || '')}</textarea></label>
          </div>
          <div class="modal-footer">${creating ? '' : `<button class="btn btn-danger" type="button" data-action="delete-prospect" data-id="${attr(p.id)}">Supprimer</button>`}<div class="spacer"></div><button class="btn" type="button" data-action="close-editor">Annuler</button><button class="btn btn-dark" type="submit">${creating ? 'Ajouter le prospect' : 'Enregistrer'}</button></div>
        </form>
        ${creating ? '' : `<section class="timeline-section"><h3>Historique</h3><form class="activity-row" data-form="activity" data-id="${attr(p.id)}"><select class="select-input" name="activity_type"><option>Note</option><option>Email</option><option>Appel</option><option>Relance</option><option>RDV</option><option>Proposition</option></select><input class="text-input" name="note" placeholder="Ajouter une action ou une note…" required /><button class="btn btn-purple" type="submit">Ajouter</button></form><div class="timeline">${state.timeline.length ? state.timeline.map(item => `<div class="timeline-item"><div class="timeline-dot"></div><div><strong>${esc(item.text)}</strong><small>${new Date(item.at).toLocaleString('fr-FR')}</small></div></div>`).join('') : '<p style="color:var(--muted)">Aucun historique pour le moment.</p>'}</div></section>`}
      </div>
    </section>
  </div>`
}

function render() {
  if (state.loading) return
  if (state.backend === 'supabase' && !state.session) app.innerHTML = renderAuth()
  else app.innerHTML = renderAppShell()
}

function nullable(value) {
  const clean = String(value ?? '').trim()
  return clean ? clean : null
}

function prospectPayload(formData) {
  return {
    company: String(formData.get('company') || '').trim(),
    contact_name: nullable(formData.get('contact_name')),
    email: nullable(formData.get('email')),
    status: String(formData.get('status') || 'Identifié'),
    owner_id: nullable(formData.get('owner_id')),
    contact_date: nullable(formData.get('contact_date')),
    followup_date: nullable(formData.get('followup_date')),
    next_meeting: nullable(formData.get('next_meeting')),
    competitor: nullable(formData.get('competitor')),
    contract_end: nullable(formData.get('contract_end')),
    reminder_date: nullable(formData.get('reminder_date')),
    priority: nullable(formData.get('priority')) || 'Normale',
    notes: nullable(formData.get('notes')),
  }
}

function rerenderAndRefocus(searchName, position) {
  render()
  requestAnimationFrame(() => {
    const input = app.querySelector(`[data-search="${searchName}"]`)
    if (input) {
      input.focus()
      if (typeof input.setSelectionRange === 'function') input.setSelectionRange(position, position)
    }
  })
}

app.addEventListener('input', event => {
  const target = event.target
  const searchName = target?.dataset?.search
  if (!searchName) return
  state.query = target.value
  rerenderAndRefocus(searchName, target.selectionStart ?? target.value.length)
})

app.addEventListener('change', async event => {
  const target = event.target
  try {
    if (target?.dataset?.change === 'status-filter') {
      state.statusFilter = target.value
      state.filterOpen = false
      render()
    }
    if (target?.dataset?.change === 'quick-status') {
      await updateProspect(target.dataset.id, { status: target.value })
      render()
    }
  } catch (error) {
    console.error(error); toast(error.message || 'Une erreur est survenue.', true)
  }
})

app.addEventListener('click', async event => {
  const actionNode = event.target.closest('[data-action]')
  if (!actionNode) return
  const action = actionNode.dataset.action
  try {
    if (action === 'nav') {
      state.view = actionNode.dataset.view
      state.filterOpen = false
      render()
    } else if (action === 'select-prospect') {
      if (event.target.closest('[data-action="edit-prospect"]')) return
      state.selectedId = actionNode.dataset.id
      render()
    } else if (action === 'pipeline-select') {
      state.selectedId = actionNode.dataset.id
      state.view = 'dashboard'
      render()
    } else if (action === 'close-detail') {
      state.selectedId = null
      render()
    } else if (action === 'toggle-filter') {
      state.filterOpen = !state.filterOpen
      render()
    } else if (action === 'sort') {
      const key = actionNode.dataset.key
      if (state.sortKey === key) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
      else { state.sortKey = key; state.sortDirection = 'asc' }
      render()
    } else if (action === 'add-prospect') {
      state.editor = { id: null }
      state.timeline = []
      render()
    } else if (action === 'edit-prospect') {
      event.stopPropagation()
      state.editor = { id: actionNode.dataset.id }
      await loadTimeline(actionNode.dataset.id)
      render()
    } else if (action === 'close-editor') {
      state.editor = null; state.timeline = []; render()
    } else if (action === 'modal-backdrop' && event.target === actionNode) {
      state.editor = null; state.timeline = []; render()
    } else if (action === 'delete-prospect') {
      await deleteProspect(actionNode.dataset.id)
    } else if (action === 'plan-reminder') {
      const input = document.querySelector('#quick-reminder-date')
      input?.focus()
      input?.showPicker?.()
    } else if (action === 'toggle-user') {
      state.userMenuOpen = !state.userMenuOpen
      render()
    } else if (action === 'logout') {
      await state.supabase.auth.signOut()
    } else if (action === 'reset-demo') {
      localStorage.removeItem('crm-prospection-demo-v2')
      state.prospects = []
      state.userMenuOpen = false
      await loadDemo()
      render()
      toast('Données locales réinitialisées.')
    } else if (action === 'toggle-auth') {
      state.authMode = state.authMode === 'login' ? 'signup' : 'login'
      state.authMessage = ''
      render()
    }
  } catch (error) {
    console.error(error)
    toast(error.message || 'Une erreur est survenue.', true)
  }
})

app.addEventListener('submit', async event => {
  const form = event.target
  const formName = form?.dataset?.form
  if (!formName) return
  event.preventDefault()
  const submitButton = form.querySelector('[type="submit"]')
  if (submitButton) submitButton.disabled = true
  try {
    const data = new FormData(form)
    if (formName === 'auth') {
      state.authMessage = ''
      const email = String(data.get('email') || '')
      const password = String(data.get('password') || '')
      const result = state.authMode === 'login'
        ? await state.supabase.auth.signInWithPassword({ email, password })
        : await state.supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
      if (result.error) state.authMessage = result.error.message
      else if (state.authMode === 'signup' && !result.data.session) state.authMessage = 'Compte créé. Vérifiez votre email si la confirmation est activée dans Supabase.'
      render()
    } else if (formName === 'quick-save') {
      const id = form.dataset.id
      await updateProspect(id, {
        owner_id: nullable(data.get('owner_id')),
        competitor: nullable(data.get('competitor')),
        contract_end: nullable(data.get('contract_end')),
        reminder_date: nullable(data.get('reminder_date')),
        notes: nullable(data.get('notes')),
      })
      render()
    } else if (formName === 'editor') {
      const id = form.dataset.id
      const payload = prospectPayload(data)
      if (!payload.company) throw new Error('Le nom de l’entreprise est obligatoire.')
      if (id) await updateProspect(id, payload)
      else await createProspect(payload)
      state.editor = null
      state.timeline = []
      render()
    } else if (formName === 'activity') {
      await addActivity(form.dataset.id, String(data.get('activity_type') || 'Note'), String(data.get('note') || ''))
      render()
    }
  } catch (error) {
    console.error(error)
    if (formName === 'auth') { state.authMessage = error.message || 'Connexion impossible.'; render() }
    else toast(error.message || 'Une erreur est survenue.', true)
  } finally {
    if (submitButton?.isConnected) submitButton.disabled = false
  }
})

async function init() {
  try {
    if (HAS_CONFIG) await initSupabase()
    else await loadDemo()
  } catch (error) {
    console.error(error)
    app.innerHTML = `<main class="boot-screen"><img src="./assets/logo.svg" alt="" width="54" height="54" /><h2>Impossible de charger le CRM</h2><p>${esc(error.message)}</p></main>`
    return
  }
  render()
}

init()