import 'server-only'
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/require-admin'

// 🎯 پچ ۶۴ — ورود شیفت با موبایل: توکن کوتاه‌عمر برای کارمندِ دارای اکانت پنل
// جریان: شمارهٔ موبایل ثبت‌شده در staff_members + کد پیامکی (staff-otp) ←
// کوکی امضاشدهٔ HMAC ← API شیفت‌ها با resolveShiftActor همان کارمند را می‌شناسد.
// امنیت: امضا با hash سرویس‌کلید (هرگز از سرور خارج نمی‌شود) + بازبینی DB در
// هر درخواست + TTL ۱۲ ساعته. غیرفعال‌شدن کارمند، توکن را فوراً بی‌اثر می‌کند.

export const STAFF_SHIFT_COOKIE = 'cafe-park-staff-shift'
const STAFF_SHIFT_TTL_MS = 12 * 60 * 60 * 1000 // یک شیفت کامل

function signingSecret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'cafe-park-fallback'
  return crypto
    .createHash('sha256')
    .update(`${key}|staff-shift-v1`)
    .digest('hex')
}

function signPayload(payload: string): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(payload)
    .digest('base64url')
}

// صدور کوکی شیفت کارمند — فقط سمت سرور (routeهای staff-otp)
export function issueStaffShiftCookie(
  res: NextResponse,
  staffId: number,
  authUserId: string
): void {
  const exp = Date.now() + STAFF_SHIFT_TTL_MS
  const payload = `v1.${staffId}.${authUserId}.${exp}`
  res.cookies.set(STAFF_SHIFT_COOKIE, `${payload}.${signPayload(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(STAFF_SHIFT_TTL_MS / 1000),
    path: '/',
  })
}

// پاک کردن کوکی (خروج کارمند از صفحهٔ شیفت)
export function clearStaffShiftCookie(res: NextResponse): void {
  res.cookies.set(STAFF_SHIFT_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
}

// خواندن بدون بازبینی DB — فقط برای رندر صفحهٔ /shift؛
// API شیفت‌ها خودش در resolveShiftActor بازبینی کامل می‌کند.
export async function peekStaffShiftCookie(): Promise<{
  staffId: number
  authUserId: string
} | null> {
  const store = await cookies()
  const raw = store.get(STAFF_SHIFT_COOKIE)?.value || ''
  const parts = raw.split('.')
  if (parts.length !== 5 || parts[0] !== 'v1') return null
  const [, staffIdStr, authUserId, expStr, sig] = parts
  if (!/^\d+$/.test(staffIdStr) || !/^\d+$/.test(expStr)) return null
  if (Number(expStr) < Date.now()) return null
  const payload = `v1.${staffIdStr}.${authUserId}.${expStr}`
  const expected = signPayload(payload)
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return { staffId: Number(staffIdStr), authUserId }
}

export type ShiftActor =
  | { denied: null; userId: string; via: 'admin' | 'staff' }
  | { denied: NextResponse; userId?: undefined; via?: undefined }

// 🎯 تصمیم واحد هویتِ شیفت: جلسهٔ پنل (requireAdminUser) یا توکن کارمند موبایل
export async function resolveShiftActor(): Promise<ShiftActor> {
  const admin = await requireAdminUser()
  if (!admin.denied) return { denied: null, userId: admin.userId, via: 'admin' }

  const peeked = await peekStaffShiftCookie()
  if (!peeked) {
    return {
      denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // بازبینی DB در هر درخواست — غیرفعال‌شدن کارمند یا قطع لینک اکانت،
  // توکن را بی‌اثر می‌کند؛ همچنین پروفایل اپراتوری باید موجود باشد
  const db = supabaseAdmin()
  const { data: staff } = await db
    .from('staff_members')
    .select('id, auth_user_id, is_active')
    .eq('id', peeked.staffId)
    .maybeSingle()
  if (!staff?.is_active || staff.auth_user_id !== peeked.authUserId) {
    return {
      denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const { data: prof } = await db
    .from('admin_operator_profiles')
    .select('user_id')
    .eq('user_id', peeked.authUserId)
    .maybeSingle()
  if (!prof) {
    return {
      denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { denied: null, userId: peeked.authUserId, via: 'staff' }
}
