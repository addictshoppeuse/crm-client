// Service worker minimal : rend l'application installable (icône sur l'écran d'accueil).
// Aucune mise en cache : le CRM lit toujours la version en ligne et Supabase en direct.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request))
})
