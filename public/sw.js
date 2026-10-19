// public/sw.js — Service Worker برای کافه پارک

const CACHE_NAME = 'cafe-park-v3'
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ─── Install ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// ─── Activate ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// ─── Fetch ───
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return
  }

  const isStaticAsset = url.pathname.match(
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|otf)$/
  )

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})

// ═══════════════════════════════════════════════════════════
// 🔔 PUSH NOTIFICATION
// ═══════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'کافه پارک', body: 'پیام جدیدی دارید' }
  }

    const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'fa',
    tag: data.tag || 'order-update',
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false, // 👈 اینو false کن تا خودش بعد از چند ثانیه بره
    silent: false
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of allClients) {
        const clientUrl = new URL(client.url)
        const target = new URL(targetUrl, self.location.origin)
        if (clientUrl.pathname === target.pathname) {
          return client.focus()
        }
      }

      return clients.openWindow(targetUrl)
    })()
  )
})