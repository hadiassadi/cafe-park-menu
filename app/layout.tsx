import './globals.css'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { getSettings } from '@/lib/menu'

// اگر فایل‌های Medium و Bold را هم داری، این‌جا اضافه‌شان کن
// تا font-weight 500/700 مصنوعی ساخته نشود:
//   src: [
//     { path: './fonts/Vazirmatn-Regular.woff2', weight: '400', style: 'normal' },
//     { path: './fonts/Vazirmatn-Medium.woff2',  weight: '500', style: 'normal' },
//     { path: './fonts/Vazirmatn-Bold.woff2',    weight: '700', style: 'normal' },
//   ],
const vazir = localFont({
  src: './fonts/Vazirmatn-Regular.woff2',
  display: 'swap',
  variable: '--font-vazir',
})

const SITE_URL = 'https://cafe-park-menu.vercel.app'

// عنوان و پیش‌نمایش لینک از «تنظیمات» در پنل ادمین می‌آید
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null)

  const name = s?.cafe_name?.trim() || 'کافه پارک'
  const baseTitle = `منوی ${name}`
  const description =
    s?.tagline?.trim() || `منوی آنلاین ${name} — قهوه، نوشیدنی و غذا`

  const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: { default: baseTitle, template: `%s | ${name}` },
    description,
  }

  // اگر پیش‌نمایش لینک فعال باشد (پیش‌فرض: فعال)
  if (s?.og_enabled !== false) {
    const ogTitle = s?.og_title?.trim() || baseTitle
    const ogDescription = s?.og_description?.trim() || description
    const ogImage = s?.og_image_url?.trim()

    metadata.openGraph = {
      title: ogTitle,
      description: ogDescription,
      locale: 'fa_IR',
      type: 'website',
      siteName: name,
      url: '/',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    }
    metadata.twitter = {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description: ogDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    }
  }

  return metadata
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#6b4f3a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body>{children}</body>
    </html>
  )
}
