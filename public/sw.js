// public/sw.js — Service Worker برای کافه پارک

const CACHE_NAME = 'cafe-park-v2'
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

// ─── Activate: پاک کردن cacheهای قدیمی ───
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

  // فقط GET
  if (request.method !== 'GET') return

  // API و Supabase رو کش نکن
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase')
  ) {
    return
  }

  // ⚠️ تصاویر و فونت‌ها: Cache First
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

  // ⚠️ HTML، JS، CSS: Network First (همیشه نسخه جدید)
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
        // حالت آفلاین
        return caches.match(request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})