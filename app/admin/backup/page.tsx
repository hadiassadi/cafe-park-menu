import type { Metadata } from 'next'
import BackupClient from './BackupClient'

export const metadata: Metadata = {
  title: 'پشتیبان‌گیری',
  robots: { index: false, follow: false },
}

export default function AdminBackupPage() {
  return (
    <main className="admin">
      <BackupClient />
    </main>
  )
}
