import CategoriesGrid from './CategoriesGrid'
import { getMenuData } from '@/lib/menu'
import { SITE_URL } from '@/lib/site'

export const revalidate = 300

function instagramUrl(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  const handle = (m ? m[1] : raw.replace(/^@/, '')).replace(/[^A-Za-z0-9._]/g, '')
  return handle ? `https://instagram.com/${handle}` : null
}

export default async function Page() {
  const data = await getMenuData()
  const s = data.settings

  const ig = s?.show_instagram !== false ? instagramUrl(s?.instagram) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: s?.cafe_name || 'کافه پارک',
    alternateName: s?.tagline || undefined,
    url: SITE_URL,
    hasMenu: SITE_URL,
    menu: SITE_URL,

    ...(s?.logo_url ? { image: s.logo_url, logo: s.logo_url } : {}),

    ...(s?.show_phone !== false && s?.phone
      ? {
          telephone: s.phone
            .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
            .replace(/[^\d+]/g, ''),
        }
      : {}),

    ...(s?.show_address !== false && s?.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: s.address,
            addressLocality: 'شیراز',
            addressRegion: 'فارس',
            addressCountry: 'IR',
          },
        }
      : {}),

    ...(s?.working_hours
      ? {
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification',
              description: s.working_hours,
            },
          ],
        }
      : {}),

    ...(s?.maps_url ? { hasMap: s.maps_url } : {}),
    ...(ig ? { sameAs: [ig] } : {}),

    priceRange: '$$',
    servesCuisine: ['قهوه', 'نوشیدنی', 'غذا'],
    acceptsReservations: 'False',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <CategoriesGrid initial={data} />
    </>
  )
}