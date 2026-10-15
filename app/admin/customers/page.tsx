import type { Metadata } from 'next'
import CustomersManager from './CustomersManager'

export const metadata: Metadata = {
  title: 'مشتریان',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function CustomersPage() {
  return <CustomersManager />
}