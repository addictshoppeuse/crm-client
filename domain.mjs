export const STATUSES = [
  'Identifié',
  'Contacté',
  'Relancé',
  'Call prévu',
  'Proposition',
  'Gagné',
  'Perdu',
  'À recontacter',
]

export const STATUS_META = {
  'Identifié': { bg: '#FAECE7', text: '#993C1D' },
  'Contacté': { bg: '#EEEDFE', text: '#3C3489' },
  'Relancé': { bg: '#E1F5EE', text: '#085041' },
  'Call prévu': { bg: '#FAEEDA', text: '#633806' },
  'Proposition': { bg: '#E6F1FB', text: '#0C447C' },
  'Gagné': { bg: '#EAF3DE', text: '#27500A' },
  'Perdu': { bg: '#FCEBEB', text: '#791F1F' },
  'À recontacter': { bg: '#F3E5F5', text: '#4A235A' },
}

export function countByStatus(prospects) {
  const counts = Object.fromEntries(STATUSES.map(status => [status, 0]))
  for (const prospect of prospects) {
    if (prospect?.status in counts) counts[prospect.status] += 1
  }
  return counts
}

export function filterProspects(prospects, query = '', status = 'Tous') {
  const q = query.trim().toLocaleLowerCase('fr-FR')
  return prospects.filter(prospect => {
    if (status !== 'Tous' && prospect.status !== status) return false
    if (!q) return true
    const haystack = [prospect.company, prospect.contact_name, prospect.email, prospect.notes, prospect.competitor]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fr-FR')
    return haystack.includes(q)
  })
}

export function nextReminderDate(prospect) {
  return prospect.reminder_date || prospect.followup_date || null
}

export function getDueReminders(prospects, today) {
  return prospects
    .filter(prospect => !['Gagné', 'Perdu'].includes(prospect.status))
    .filter(prospect => {
      const date = nextReminderDate(prospect)
      return Boolean(date && date <= today)
    })
    .slice()
    .sort((a, b) => String(nextReminderDate(a)).localeCompare(String(nextReminderDate(b))))
}

export function formatDateFr(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

export function formatLongDateFr(date = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date).replace(/^./, char => char.toUpperCase())
}

export function sortProspects(prospects, key, direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1
  return prospects.slice().sort((a, b) => {
    const av = a?.[key] ?? ''
    const bv = b?.[key] ?? ''
    return String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base', numeric: true }) * sign
  })
}

export function initials(value = '') {
  const parts = String(value).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('')
}

export function todayIso(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function makeId(cryptoLike = globalThis.crypto) {
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') return cryptoLike.randomUUID()
  const rand = Math.random().toString(36).slice(2, 10)
  return `local-${Date.now().toString(36)}-${rand}`
}
