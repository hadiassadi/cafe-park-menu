import type { Metadata } from 'next'
import CancellationsManager from './CancellationsManager'

export const metadata: Metadata = {
  title: 'آمار لغو سفارش‌ها',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function CancellationsPage() {
  return <CancellationsManager />
}