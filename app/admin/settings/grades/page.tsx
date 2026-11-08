import type { Metadata } from 'next'
import GradesManager from './GradesManager'

export const metadata: Metadata = {
  title: 'گرید مشتریان',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function GradesSettingsPage() {
  return <GradesManager />
}
