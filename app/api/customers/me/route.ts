import { NextResponse } from 'next/server'
import { getCurrentCustomer } from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const customer = await getCurrentCustomer()
  return NextResponse.json(
    { customer },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}