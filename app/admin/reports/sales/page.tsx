import type { Metadata } from 'next'
import SalesReportsManager from './SalesReportsManager'

export const metadata: Metadata = {
  title: 'گزارش فروش',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function SalesReportsPage() {
  return <SalesReportsManager />
}