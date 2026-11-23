import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getStepUpCookieName } from '@/lib/admin/stepup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۵ — پاک‌سازی کامل نشست‌های auth در همین مرورگر:
// صفحهٔ ورود قبل از signIn این را صدا می‌زند تا هیچ نشست قدیمی (حتی کوکی‌های
// httpOnly که با document.cookie پاک نمی‌شوند) باقی نماند و هرگز نشست کاربر A
// به نام کاربر B ثبت نشود. کوکی‌های sb-* (و قطعه‌های chunked) + کوکی شیفت
// کارمند + کوکی step-up همه با maxAge=0 باطل می‌شوند.
const STAFF_SHIFT_COOKIE = 'cafe-park-staff-shift'

export async function POST() {
  const store = await cookies()
  const names = store.getAll().map((c) => c.name)
  const res = NextResponse.json({ ok: true, cleared: names.length })

  for (const name of names) {
    const isAuthCookie =
      name.startsWith('sb-') || name === STAFF_SHIFT_COOKIE || name === getStepUpCookieName()
    if (!isAuthCookie) continue
    res.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  return res
}
