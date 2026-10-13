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

  // ─── داده ساختاریافته برای گوگل ───
  // اطلاعات کافه به صورت JSON-LD به گوگل معرفی می‌شود تا در نتایج جستجو
  // به شکل «کارت کسب‌وکار» (آدرس، تلفن، ساعات کار) نمایش داده شود.
  const ig = s?.show_instagram !== false ? instagramUrl(s?.instagram) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: s?.cafe_name || 'کافه پارک',
    alternateName: s?.tagline || undefined,
    url: SITE_URL,
    hasMenu: SITE_URL,
    menu: SITE_URL,

    // لوگو و تصویر
    ...(s?.logo_url ? { image: s.logo_url, logo: s.logo_url } : {}),

    // تلفن
    ...(s?.show_phone !== false && s?.phone
  ? {
      telephone: s.phone
        .replace(/[۰-۹]/g, (d) =>
          String(d.charCodeAt(0) - 0x06f0)
        )
        .replace(/[^\d+]/g, ''),
    }
  : {}),

    // آدرس
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

    // ساعات کاری
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

    // نقشه
    ...(s?.maps_url ? { hasMap: s.maps_url } : {}),

    // شبکه‌های اجتماعی
    ...(ig ? { sameAs: [ig] } : {}),

    // اطلاعات تکمیلی کافه
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
      <MenuClient initial={data} />
    </>
  )
}