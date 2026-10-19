import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { getMenuData } from '@/lib/menu'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const base: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]

  try {
    const data = await getMenuData()
    for (const cat of data.categories) {
      base.push({
        url: `${SITE_URL}/c/${cat.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  } catch (err) {
    console.error('[sitemap] error:', err)
  }

  return base
}