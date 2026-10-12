// public/sw.js — Service Worker برای کافه پارک

const CACHE_NAME = 'cafe-park-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ─── Install: cache کردن فایل‌های پایه ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // اگه یکی از فایل‌ها نبود، بقیه رو ادامه بده
      })
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

// ─── Fetch: استراتژی Network First برای API، Cache First برای بقیه ───
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // فقط GET رو کش کن
  if (request.method !== 'GET') return

  // API و Supabase رو کش نکن
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase')
  ) {
    return
  }

  // فونت‌ها، تصاویر، CSS و JS: Cache First
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?|css|js)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
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

  // بقیه (HTML): Network First با fallback به cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.mode === 'navigate') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  )
})