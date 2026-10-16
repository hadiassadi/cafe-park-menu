import type { Metadata } from 'next'
import PaymentSettingsManager from './PaymentSettingsManager'

export const metadata: Metadata = {
  title: 'تنظیمات پرداخت',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function PaymentSettingsPage() {
  return <PaymentSettingsManager />
}