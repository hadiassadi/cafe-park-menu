import './globals.css'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'منوی کافه پارک | پارک سلامت شیراز',
    template: '%s | کافه پارک',
  },
  description:
    'منوی آنلاین کافه پارک — پارک سلامت شیراز. قهوه، نوشیدنی و غذا.',
  openGraph: {
    title: 'منوی کافه پارک | پارک سلامت شیراز',
    description: 'منوی آنلاین کافه پارک؛ قهوه، نوشیدنی و غذا',
    locale: 'fa_IR',
    type: 'website',
    siteName: 'کافه پارک',
    url: '/',
    // برای پیش‌نمایش در تلگرام و واتساپ: یک عکس ۱۲۰۰×۶۳۰ با اسم
    // opengraph-image.png (یا .jpg) داخل پوشه app/ بگذار؛ خودکار اضافه می‌شود.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'منوی کافه پارک | پارک سلامت شیراز',
    description: 'منوی آنلاین کافه پارک؛ قهوه، نوشیدنی و غذا',
  },
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
