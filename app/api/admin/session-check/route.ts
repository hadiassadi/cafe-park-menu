import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { getOperatorRole } from '@/lib/admin/roles'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۹-آ: تشخیص دقیق وضعیت ورود پنل — صفحهٔ ورود بعد از signIn موفق این
// endpoint را صدا می‌زند تا به‌جای برگشتِ بی‌صدا از گیت، دلیل واقعی نمایش داده
// شود: بدون نشست / بدون پروفایل (کاربر بدون نقش) / با نقش
export async function GET() {
  const auth = await requireAdminUser()
  if (auth.denied) {
    const noSession = auth.denied.status === 401
    return NextResponse.json({
      authed: !noSession,
      hasProfile: false,
      reason: noSession ? 'no-session' : 'no-profile',
    })
  }

  const me = await getOperatorRole()
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  return NextResponse.json({
    authed: true,
    hasProfile: true,
    role: me?.role ?? null,
    envAdmin: adminEmails.includes(auth.email || ''),
  })
}
