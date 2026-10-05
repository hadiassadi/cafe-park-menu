import './globals.css'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

const vazir = localFont({
  src: './fonts/Vazirmatn-Regular.woff2',
  display: 'swap',
  variable: '--font-vazir',
})

export const metadata: Metadata = {
  title: {
    default: 'کافه پارک | منو',
    template: '%s | کافه پارک',
  },
  description:
    'منوی آنلاین کافه پارک — پارک سلامت شیراز. قهوه، نوشیدنی و غذا.',
  openGraph: {
    title: 'کافه پارک | منو',
    description: 'منوی آنلاین کافه پارک',
    locale: 'fa_IR',
    type: 'website',
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
    <html lang="fa-IR" dir="rtl" className={vazir.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}