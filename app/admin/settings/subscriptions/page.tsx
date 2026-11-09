import type { Metadata } from 'next'
import SubscriptionsManager from './SubscriptionsManager'

export const metadata: Metadata = {
  title: 'اشتراک ماهیانه',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function SubscriptionsSettingsPage() {
  return <SubscriptionsManager />
}
