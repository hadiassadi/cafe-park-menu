import type { Metadata } from 'next'
import PaymentCallbackClient from './PaymentCallbackClient'

export const metadata: Metadata = {
  title: 'نتیجه پرداخت',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function PaymentCallbackPage() {
  return <PaymentCallbackClient />
}