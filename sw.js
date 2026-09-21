// Service worker minimal : rend l'application installable (icône sur l'écran d'accueil).
// Aucune mise en cache : les fichiers du site sont toujours revalidés auprès du serveur
// (cache: 'no-cache') pour que chaque mise à jour publiée soit prise immédiatement.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const sameOrigin = new URL(event.request.url).origin === self.location.origin
  event.respondWith(sameOrigin ? fetch(event.request, { cache: 'no-cache' }) : fetch(event.request))
})
