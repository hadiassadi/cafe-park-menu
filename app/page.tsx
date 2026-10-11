// app/page.tsx  (Server Component، بدون 'use client')
import MenuClient from './MenuClient'
import { getMenuData } from '@/lib/menu'
import { SITE_URL } from '@/lib/site'

// صفحه هر ۵ دقیقه تازه می‌شود. برای اعمال فوری تغییرات،
// بعد از ذخیره در پنل ادمین revalidatePath صدا زده می‌شود.
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

  // داده ساختاریافته برای گوگل (فقط مواردی که در منو نمایش داده می‌شوند)
  const ig = s?.show_instagram !== false ? instagramUrl(s?.instagram) : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: s?.cafe_name || 'کافه پارک',
    url: SITE_URL,
    hasMenu: SITE_URL,
    ...(s?.logo_url ? { image: s.logo_url, logo: s.logo_url } : {}),
    ...(s?.show_phone !== false && s?.phone ? { telephone: s.phone } : {}),
    ...(s?.show_address !== false && s?.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: s.address,
            addressCountry: 'IR',
          },
        }
      : {}),
    ...(ig ? { sameAs: [ig] } : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <MenuClient initial={data} />
    </>
  )
}
