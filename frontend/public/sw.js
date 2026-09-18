const CACHE_VERSION = 'plait-shell-v1'
const SHELL_CACHE = CACHE_VERSION
const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/icon_512.png', '/icon_white.png']

const isTransactionalRequest = (url, request) => {
  if (request.method !== 'GET') return true
  return /\/api\/(sessions|orders|payments|analytics|waiter|calls|auth)(\/|\?|$)/i.test(url.pathname)
}

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  (/\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname) || url.pathname.startsWith('/assets/'))

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.origin !== self.location.origin || isTransactionalRequest(url, request)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match('/index.html').then((response) => response || Response.error()))
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()))
          return response
        }).catch(() => cached || Response.error())
        return cached || network
      })
    )
  }
})
