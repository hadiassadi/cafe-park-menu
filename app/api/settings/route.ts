import { requireAdmin } from '@/lib/admin/require-admin'
import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// شناسه‌ی درگاه پرداخت هرگز نباید از این مسیر خارج شود
// (فقط مسیرهای پرداخت سمت سرور آن را می‌خوانند)
function stripSecrets(row: Record<string, unknown> | null) {
  const safe: Record<string, unknown> = { ...(row ?? {}) }
  delete safe.payment_merchant_id
  return safe
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const db = supabaseAdmin()

  const { data, error } = await db
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return apiError(error, 'خطای پایگاه داده')
  }

  return NextResponse.json(
    stripSecrets(data as Record<string, unknown> | null)
  )
}

const TEXT_FIELDS = [
  'cafe_name',
  'tagline',
  'hero_title',
  'hero_subtitle',
  'footer_text',
  'address',
  'phone',
  'instagram',
  'working_hours',
  'og_title',
  'og_description',
  // ✅ پرداخت
  'card_number',
  'card_holder',
  'bank_name',
  'sheba_number',
  'payment_note',
  // ✅ پیام‌رسان‌ها
  'cafe_phone',
  'eitaa_id',
  'bale_id',
  'rubika_id',
]

// آدرس‌ها: خالی یا فقط http/https
const URL_FIELDS = [
  'logo_url',
  'maps_url',
  'og_image_url',
  'hero_bg_image_url',
  'bg_image_url',
]

const BOOL_FIELDS = [
  'og_enabled',
  'show_address',
  'show_phone',
  'show_instagram',
  'show_working_hours',
  'show_quote',
  'show_share_button',
  'show_featured_filter',
  'show_product_images',
  'show_product_size',
  'show_footer',
  'bg_enabled',
  'floating_enabled',
  'address_in_header',
  'address_in_footer',
  'address_in_floating',
  'phone_in_header',
  'phone_in_footer',
  'phone_in_floating',
  'instagram_in_header',
  'instagram_in_footer',
  'instagram_in_floating',
  'hours_in_header',
  'hours_in_footer',
  // ✅ پرداخت
  'payment_enabled',
  'request_card_enabled',
  // ✅ پیام‌رسان‌ها
  'whatsapp_enabled',
  'eitaa_enabled',
  'bale_enabled',
  'rubika_enabled',
  // ✅ امنیت (جدید)
  'admin_allow_delete_orders',
]

// مقدارهای مجاز برای فیلدهای انتخابی
const ENUM_FIELDS: Record<string, string[]> = {
  hero_bg_mode: ['color', 'image'],
  contact_header_style: ['icons', 'text'],
  floating_side: ['left', 'right'],
}

// فیلدهای عددی با بازه مجاز
const INT_FIELDS: Record<string, [number, number]> = {
  hero_overlay: [0, 80],
  bg_overlay: [0, 98],
}

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v)

export async function PATCH(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const db = supabaseAdmin()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const updates: Record<string, string | boolean | number | string[] | null> = {}

  for (const key of TEXT_FIELDS) {
    const v = body[key]
    if (typeof v === 'string') {
      updates[key] = v.trim().slice(0, 1000)
    }
  }

  for (const key of URL_FIELDS) {
    const v = body[key]
    if (typeof v === 'string') {
      const value = v.trim().slice(0, 1000)
      if (value && !isHttpUrl(value)) {
        return NextResponse.json(
          { error: 'آدرس‌ها باید با http:// یا https:// شروع شوند.' },
          { status: 400 }
        )
      }
      updates[key] = value || null
    }
  }

  for (const key of BOOL_FIELDS) {
    const v = body[key]
    if (typeof v === 'boolean') {
      updates[key] = v
    }
  }

  for (const [key, allowed] of Object.entries(ENUM_FIELDS)) {
    const v = body[key]
    if (typeof v === 'string' && allowed.includes(v)) {
      updates[key] = v
    }
  }

  for (const [key, [min, max]] of Object.entries(INT_FIELDS)) {
    const n = Number(body[key])
    if (body[key] !== undefined && Number.isFinite(n)) {
      updates[key] = Math.min(max, Math.max(min, Math.round(n)))
    }
  }

  // مجموعه تصاویر پس‌زمینه (حداکثر ۱۲ آدرس معتبر)
  if (Array.isArray(body.bg_gallery)) {
    updates.bg_gallery = body.bg_gallery
      .filter((u: unknown): u is string => typeof u === 'string' && isHttpUrl(u))
      .slice(0, 12)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await db
    .from('settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'خطا در ذخیره تنظیمات' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    stripSecrets(data as Record<string, unknown> | null)
  )
}
