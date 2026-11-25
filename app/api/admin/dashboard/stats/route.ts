// app/api/admin/dashboard/stats/route.ts
// 🎯 پچ ۷۱ — دادهٔ تب‌های سنگین داشبورد به‌صورت on-demand
//   داشبورد در لود اولیه فقط آمار سبک (۳۵ روز) را سمت سرور می‌گیرد؛
//   دادهٔ «نمودارها» و «پرفروش‌ها» فقط وقتی کاربر آن تب را باز کند از این
//   API خوانده می‌شود (کامپوننت‌های ChartsPanel / TopProductsPanel).
//   گِیت نقش: مالک/مدیر، یا لیست دسترسی دلخواه با تیک «گزارش فروش» —
//   صندوق‌دار/کارمند به آمار کل مجموعه دسترسی ندارد.
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRole } from '@/lib/admin/roles'
import { getChartStats, getTopProducts } from '@/lib/dashboard-stats'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const me = await getOperatorRole()
    if (!me) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const canSeeFinance =
      me.role === 'owner' ||
      me.role === 'manager' ||
      (Array.isArray(me.allowedPaths) &&
        me.allowedPaths.length > 0 &&
        me.allowedPaths.some(
          (p) => p === '/admin/reports/sales' || p.startsWith('/admin/reports/sales/')
        ))
    if (!canSeeFinance) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const part = request.nextUrl.searchParams.get('part') ?? 'charts'

    if (part === 'top') {
      const top = await getTopProducts()
      return NextResponse.json(
        { top },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const charts = await getChartStats()
    return NextResponse.json(
      { charts },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[dashboard stats api] unexpected:', err)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
