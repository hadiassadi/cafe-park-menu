import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
}

// ✅ فرمت امن برای CSV
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ✅ برای فیلدهای متنی که Excel نباید عدد در نظر بگیره
// (شماره تماس، شماره سفارش، کد کوپن، ...)
function csvForceText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  if (!str) return ''
  // فرمول `="..."` باعث می‌شه Excel مقدار رو متن در نظر بگیره
  return `"=""${str.replace(/"/g, '""')}"""`
}

// ✅ تبدیل اقلام به متن
function itemsToText(items: OrderItem[]): string {
  if (!Array.isArray(items)) return ''
  return items
    .map((item) => {
      const base = `${item.quantity} × ${item.product_name}`
      const option = item.option_name ? ` (${item.option_name})` : ''
      return base + option
    })
    .join(' | ')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'all' // today|week|month|all
  const status = searchParams.get('status') || 'all' // all|delivered|pending|cancelled

  try {
    const db = await supabaseServer()

    let query = db
      .from('orders')
      .select(
        'id, order_number, customer_name, customer_phone, table_number, note, items, subtotal, original_subtotal, coupon_code, coupon_discount, status, created_at'
      )
      .order('created_at', { ascending: false })

    // فیلتر زمانی
    if (filter === 'today') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    } else if (filter === 'week') {
      const start = new Date()
      const day = start.getDay()
      const diff = day === 6 ? 0 : day + 1
      start.setDate(start.getDate() - diff)
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    } else if (filter === 'month') {
      const start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    }

    // فیلتر وضعیت
    if (status === 'delivered') {
      query = query.eq('status', 'delivered')
    } else if (status === 'cancelled') {
      query = query.eq('status', 'cancelled')
    } else if (status === 'active') {
      query = query.in('status', ['pending', 'confirmed', 'preparing', 'ready'])
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('[export orders] error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // ─── ساخت CSV ───
    const headers = [
      'شماره سفارش',
      'تاریخ',
      'ساعت',
      'نام مشتری',
      'شماره تماس',
      'شماره میز',
      'اقلام',
      'مبلغ اصلی',
      'تخفیف',
      'کد کوپن',
      'مبلغ پرداختی',
      'وضعیت',
      'توضیحات',
    ]

    const rows = (orders ?? []).map((order) => {
      const created = new Date(order.created_at)
      const dateStr = created.toLocaleDateString('fa-IR')
      const timeStr = created.toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      })

      const statusLabels: Record<string, string> = {
        pending: 'جدید',
        confirmed: 'تأیید شده',
        preparing: 'در حال آماده‌سازی',
        ready: 'آماده تحویل',
        delivered: 'تحویل شده',
        cancelled: 'لغو شده',
      }

            return [
        csvForceText(order.order_number),           // شماره سفارش
        csvEscape(dateStr),                          // تاریخ
        csvEscape(timeStr),                          // ساعت
        csvEscape(order.customer_name),              // نام مشتری
        csvForceText(order.customer_phone),          // ✅ شماره تماس
        csvEscape(order.table_number ?? ''),         // شماره میز
        csvEscape(itemsToText(order.items as OrderItem[])), // اقلام
        csvEscape(order.original_subtotal ?? order.subtotal), // مبلغ اصلی
        csvEscape(order.coupon_discount ?? 0),       // تخفیف
        csvEscape(order.coupon_code ?? ''),          // کد کوپن
        csvEscape(order.subtotal),                    // مبلغ پرداختی
        csvEscape(statusLabels[order.status] || order.status), // وضعیت
        csvEscape(order.note ?? ''),                 // توضیحات
      ]
    })

    // ✅ BOM برای Excel فارسی
    const BOM = '\uFEFF'
    const csvContent =
      BOM +
      headers.map(csvEscape).join(',') +
      '\n' +
      rows.map((row) => row.join(',')).join('\n')

        // ✅ اسم فایل با تاریخ میلادی (ASCII-safe)
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const fileName = `orders-${y}-${m}-${d}_${hh}-${mm}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        // برای نام فایل با یونیکد (پشتیبانی در مرورگرهای مدرن):
        'Content-Disposition-UTF8': `attachment; filename*=UTF-8''${encodeURIComponent(
          `سفارشات-${y}-${m}-${d}.csv`
        )}`,
      },
    })
  } catch (err) {
    console.error('[export orders] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}