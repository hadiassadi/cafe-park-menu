import type { Metadata } from 'next'
import MyOrdersClient from './MyOrdersClient'

export const metadata: Metadata = {
  title: 'سفارش‌های من',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function MyOrdersPage() {
  return <MyOrdersClient />
}