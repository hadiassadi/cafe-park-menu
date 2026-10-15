import { NextResponse } from 'next/server'
import { clearCustomerSession } from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  await clearCustomerSession()
  return NextResponse.json({ success: true })
}