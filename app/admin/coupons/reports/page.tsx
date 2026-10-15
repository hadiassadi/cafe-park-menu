import type { Metadata } from 'next'
import CouponReports from './CouponReports'

export const metadata: Metadata = {
  title: 'گزارش کوپن‌ها',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function CouponReportsPage() {
  return <CouponReports />
}