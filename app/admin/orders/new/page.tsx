import type { Metadata } from 'next'
import NewOrderClient from './NewOrderClient'

export const metadata: Metadata = {
  title: 'ثبت سفارش حضوری',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function NewOrderPage() {
  return (
    <main className="admin">
      <NewOrderClient />
    </main>
  )
}