import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'منوی کافه پارک',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-ا: QR امن میز — توکن تصادفی به‌جای شمارهٔ قابل حدس
export default async function TableTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const db = supabaseAdmin()

  const { data: table } = await db
    .from('tables')
    .select('number')
    .eq('qr_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!table) redirect('/')

  // منو همان مسیر همیشگی با پارامتر میز باز می‌شود — منطق MenuClient دست‌نخورده
  redirect(`/?table=${table.number}`)
}
