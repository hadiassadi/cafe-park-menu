import { NextResponse } from 'next/server'
import { getOperatorRole } from '@/lib/admin/roles'
import { APP_BUILD } from '@/lib/version'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۶ — نقش اپراتوری کاربر پنل؛ مبنای فیلتر منو و گارد مسیر در layout
// 🎯 پچ ۶۰ — لیست نهایی ماژول‌های مجاز (paths) برای منوی ماژولار
//   paths = [] یعنی «پیش‌فرض نقش» — layout همان را از ماتریس نقش می‌سازد
// 🎯 پچ ۶۰-د/هـ — email (نشانگر هویت سایدبار) + build (مُهر نسخهٔ دیپلوی)

export async function GET() {
  try {
    const me = await getOperatorRole()
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      {
        role: me.role,
        paths: me.allowedPaths ?? [],
        email: me.email,
        build: APP_BUILD,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[whoami] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
