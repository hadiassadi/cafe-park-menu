import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
}

const ALLOWED_FILTERS = ['today', 'week', 'month', 'all'] as const
const ALLOWED_STATUSES = ['all', 'delivered', 'cancelled', 'active'] as const

// جلوگیری از CSV/Formula Injection در Excel
function neutralize(str: string): string {
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let str = String(value)
  if (typeof value === 'string') str = neutralize(str)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// برای شماره تماس، شماره سفارش و ... که Excel نباید عدد در نظر بگیرد
function csvForceText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  if (!str) return ''
  return `"=""${str.replace(/"/g, '""')}"""`
}

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
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const rawFilter = searchParams.get('filter') || 'all'
    const rawStatus = searchParams.get('status') || 'all'

    const filter = (ALLOWED_FILTERS as readonly string[]).includes(rawFilter)
      ? rawFilter
      : 'all'
    const status = (ALLOWED_STATUSES as readonly string[]).includes(rawStatus)
      ? rawStatus
      : 'all'

    const db = await supabaseServer()

    let query = db
      .from('orders')
      .select(
        'id, order_number, customer_name, customer_phone, table_number, note, items, subtotal, original_subtotal, coupon_code, coupon_discount, status, created_at'
      )
      .order('created_at', { ascending: false })

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
      return apiError(error, 'خطای پایگاه داده')
    }

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

    const statusLabels: Record<string, string> = {
      pending: 'جدید',
      confirmed: 'تأیید شده',
      preparing: 'در حال آماده‌سازی',
      ready: 'آماده تحویل',
      delivered: 'تحویل شده',
      cancelled: 'لغو شده',
    }

    const rows = (orders ?? []).map((order) => {
      const created = new Date(order.created_at)
      const dateStr = created.toLocaleDateString('fa-IR')
      const timeStr = created.toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      })

      return [
        csvForceText(order.order_number),
        csvEscape(dateStr),
        csvEscape(timeStr),
        csvEscape(order.customer_name),
        csvForceText(order.customer_phone),
        csvEscape(order.table_number ?? ''),
        csvEscape(itemsToText(order.items as OrderItem[])),
        csvEscape(order.original_subtotal ?? order.subtotal),
        csvEscape(order.coupon_discount ?? 0),
        csvEscape(order.coupon_code ?? ''),
        csvEscape(order.subtotal),
        csvEscape(statusLabels[order.status] || order.status),
        csvEscape(order.note ?? ''),
      ]
    })

    const BOM = '\uFEFF'
    const csvContent =
      BOM +
      headers.map(csvEscape).join(',') +
      '\n' +
      rows.map((row) => row.join(',')).join('\n')

    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const fileName = `orders-${y}-${m}-${d}_${hh}-${mm}.csv`
    const utf8Name = encodeURIComponent(`سفارشات-${y}-${m}-${d}.csv`)

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export orders] error:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
