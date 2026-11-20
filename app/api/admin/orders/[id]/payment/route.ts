import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isPaymentMethod, paymentErrorMessage } from '@/lib/payment/methods'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 🎯 پچ ۵۰-هـ-خ: ثبت پرداخت روی سفارش از خود POS — برای تسویهٔ بخشی/کاملِ
// فاکتور اصلی یا ضمیمه‌ها. همان RPC پنل مدیریت (add_order_payment) با status
// confirmed؛ روی پرداخت لغو/حذف‌شده و مبلغِ بیشتر از باقی‌مانده خطا می‌دهد.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.denied) return auth.denied

    const rl = rateLimit(req, 'admin-pos-order-payment', 30, 60_000)
    if (!rl.ok) return tooMany(rl)

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'شناسهٔ سفارش نامعتبر است' }, { status: 400 })
    }

    const body: any = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const method = body?.method
    if (!isPaymentMethod(method)) {
      return NextResponse.json({ error: 'روش پرداخت نامعتبر است' }, { status: 400 })
    }

    const amount = Math.floor(Number(body?.amount))
    if (!Number.isFinite(amount) || amount <= 0 || amount > 500_000_000) {
      return NextResponse.json({ error: 'مبلغ پرداخت نامعتبر است' }, { status: 400 })
    }

    // 🎯 پچ ۵۰-و-الف: صندوق نقدی / کارتخوان انتخابی (اختیاری) — باید فعال باشد
    const registerId =
      typeof body?.register_id === 'string' && UUID_RE.test(body.register_id)
        ? body.register_id
        : null
    const deviceId =
      typeof body?.device_id === 'string' && UUID_RE.test(body.device_id)
        ? body.device_id
        : null

    const db = supabaseAdmin()

    // 🎯 پچ ۵۰-و-ب: یادداشت اختیاری تسویه — پیش‌فرض مثل قبل
    const payNote =
      typeof body?.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : 'ثبت از POS'

    // 🎯 پچ ۵۲-د: همهٔ خواندنی‌های مستقل در یک موج (Promise.all) — قبلاً ۵
    // رفت‌وبرگشت پشت‌سرهم به Supabase بود که تأیید تسویه را چندثانیه‌ای می‌کرد
    const [regRes, devRes, orderRes, paysRes, openShiftRes] = await Promise.all([
      registerId
        ? db
            .from('cash_registers')
            .select('id')
            .eq('id', registerId)
            .eq('is_active', true)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      deviceId
        ? db
            .from('pos_devices')
            .select('id')
            .eq('id', deviceId)
            .eq('is_active', true)
            // 🎯 ۵۰-و-ب: فقط حساب‌هایی که تیک «کارتخوان» دارند قابل انتخاب‌اند
            .eq('is_card_reader', true)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      // سفارش: فقط زنده‌ها
      db
        .from('orders')
        .select('id, subtotal, status, payment_method')
        .eq('id', id)
        .maybeSingle(),
      // باقی‌مانده = مبلغ − پرداخت‌های تأییدشده
      db
        .from('order_payments')
        .select('amount')
        .eq('order_id', id)
        .eq('status', 'confirmed'),
      // 🎯 پچ ۵۲: قفل تسویه بدون شیفت باز — برای همهٔ کاربران ادمین
      db
        .from('shifts')
        .select('id')
        .eq('opened_by', auth.userId)
        .is('closed_at', null)
        .maybeSingle(),
    ])

    if (registerId && !regRes.data) {
      return NextResponse.json(
        { error: 'صندوق انتخابی معتبر نیست' },
        { status: 400 }
      )
    }
    if (deviceId && !devRes.data) {
      return NextResponse.json(
        { error: 'کارت‌خوان انتخابی معتبر نیست' },
        { status: 400 }
      )
    }
    const order = orderRes.data
    if (orderRes.error || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if ((order as any).status === 'cancelled') {
      return NextResponse.json({ error: 'این سفارش لغو شده است' }, { status: 400 })
    }
    if (paysRes.error) {
      return NextResponse.json({ error: 'خطا در خواندن پرداخت‌ها' }, { status: 500 })
    }
    const pays = paysRes.data ?? []
    const paid = pays.reduce((s, r) => s + Number((r as any).amount), 0)
    const remaining = Math.max(0, Math.round(Number((order as any).subtotal) - paid))
    if (remaining <= 0) {
      return NextResponse.json({ error: 'این فاکتور قبلاً تسویه شده است' }, { status: 400 })
    }
    if (amount > remaining) {
      return NextResponse.json(
        { error: `مبلغ بیشتر از باقی‌مانده است (باقی‌مانده: ${remaining})` },
        { status: 400 }
      )
    }
    if (!openShiftRes.data) {
      return NextResponse.json(
        { error: '⏱ اول شیفت کاری‌ات را باز کن (چیپ شیفت در بالای صفحه)' },
        { status: 403 }
      )
    }
    const openShiftId = (openShiftRes.data as any).id as string

    // ثبت پرداخت — همان RPC پنل مدیریت
    const { error: payErr } = await db.rpc('add_order_payment', {
      p_order_id: id,
      p_method: method,
      p_amount: amount,
      p_created_by: 'admin',
      p_status: 'confirmed',
      p_note: payNote,
    })
    if (payErr) {
      console.error('[admin orders payment] rpc:', payErr)
      return NextResponse.json({ error: paymentErrorMessage(payErr.message) }, { status: 400 })
    }

    // 🎯 پچ ۵۲-د: آپدیت جانبی سفارش + پیدا کردن ردیف تازهٔ دفتر در یک موج
    // (شیفت باز از موج اول می‌آید — قبلاً همین کوئری برای بار دوم زده می‌شد)
    const [updRes, lastPayRes] = await Promise.all([
      // روش پرداخت سفارش را هم به‌روز کن (فیلدهای جانبی مثل پنل مدیریت)
      db
        .from('orders')
        .update({
          payment_method: method,
          payment_verified_at: new Date().toISOString(),
        })
        .eq('id', id),
      // آخرین ردیف confirmed همان روش/مبلغ
      db
        .from('order_payments')
        .select('id')
        .eq('order_id', id)
        .eq('method', method)
        .eq('amount', amount)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (updRes.error) {
      console.error(
        '[admin orders payment] side update:',
        (updRes as any).error?.message
      )
    }

    // 🎯 پچ ۵۰-و-الف: اتصال صندوق/دستگاه به ردیف تازهٔ دفتر (RPC فیلد ندارد) —
    // خطا فقط لاگ می‌شود، پرداخت خراب نمی‌شود
    // 🎯 پچ ۵۱: شناسنامهٔ ردیف دفتر — اپراتور + شیفت بازِ همان اپراتور
    // (همیشه ثبت می‌شود، حتی وقتی صندوق/دستگاه انتخاب نشده)
    const lastPay = (lastPayRes?.data as any) ?? null
    if (lastPay?.id) {
      await db
        .from('order_payments')
        .update({
          operator_id: auth.userId,
          ...(openShiftId ? { shift_id: openShiftId } : {}),
          ...(registerId ? { register_id: registerId } : {}),
          ...(deviceId ? { device_id: deviceId } : {}),
        })
        .eq('id', lastPay.id)
    }

    return NextResponse.json({
      ok: true,
      paid: paid + amount,
      remaining: remaining - amount,
    })
  } catch (err) {
    console.error('[admin orders payment] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
