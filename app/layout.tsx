import './globals.css'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { getSettings } from '@/lib/menu'
import { SITE_URL } from '@/lib/site'
import { CartProvider } from '@/lib/cart-context'
// ✅ تغییر: به جای CartFloatingBar، رپر آن را ایمپورت می‌کنیم
import CartFloatingBarWrapper from './components/CartFloatingBarWrapper'

const vazir = localFont({
  src: './fonts/Vazirmatn-Regular.woff2',
  display: 'swap',
  variable: '--font-vazir',
})

// ─── متادیتای داینامیک (از تنظیمات پنل ادمین) ───
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null)

  const name = s?.cafe_name?.trim() || 'کافه پارک'
  const baseTitle = `منوی ${name}`
  const description =
    s?.tagline?.trim() || `منوی آنلاین ${name} — قهوه، نوشیدنی و غذا`

  // آدرس تصویر پیش‌نمایش
  const ogImage =
    s?.og_image_url?.trim() || s?.logo_url?.trim() || '/icons/icon-512.png'

  const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: { default: baseTitle, template: `%s | ${name}` },
    description,
    keywords: [
      name,
      'کافه',
      'منو',
      'منوی آنلاین',
      'قهوه',
      'نوشیدنی',
      'غذا',
      'پارک سلامت',
      'شیراز',
    ],
    applicationName: name,
    authors: [{ name }],
    creator: name,
    publisher: name,
    alternates: {
      canonical: '/',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    manifest: '/manifest.webmanifest',
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      title: name,
      statusBarStyle: 'default',
    },
    icons: {
      icon: [
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
  }

  if (s?.og_enabled !== false) {
    const ogTitle = s?.og_title?.trim() || baseTitle
    const ogDescription = s?.og_description?.trim() || description

    metadata.openGraph = {
      title: ogTitle,
      description: ogDescription,
      locale: 'fa_IR',
      type: 'website',
      siteName: name,
      url: '/',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: name,
        },
      ],
    }

    metadata.twitter = {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    }
  }

  return metadata
}

// ─── Viewport ───
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#6b4f3a',
}

// ─── Root Layout ───
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fa-IR"
      dir="rtl"
      className={vazir.variable}
      suppressHydrationWarning
    >
      <body>
        <CartProvider>
          {children}
          {/* ✅ تغییر: از رپر استفاده می‌کنیم تا در صفحات غیرضروری مخفی شود */}
          <CartFloatingBarWrapper />
        </CartProvider>
      </body>
    </html>
  )
}