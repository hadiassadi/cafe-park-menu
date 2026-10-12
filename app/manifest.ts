import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'کافه پارک — منوی آنلاین',
    short_name: 'کافه پارک',
    description: 'منوی آنلاین کافه پارک — پارک سلامت شیراز',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f3eb',
    theme_color: '#6b4f3a',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'fa-IR',
    scope: '/',
    categories: ['food', 'drink', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}