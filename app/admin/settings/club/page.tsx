import type { Metadata } from 'next'
import ClubSettingsManager from './ClubSettingsManager'

export const metadata: Metadata = {
  title: 'قوانین اعتبار',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function ClubSettingsPage() {
  return <ClubSettingsManager />
}
