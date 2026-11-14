import 'server-only'
import { loadActiveFees, feeForProduct } from '@/lib/orders/takeaway'

// 🎯 پچ ۵۰-هـ-و: قیمت‌گذاری سروری آیتم‌های POS — منطق مشترک «ثبت» و «ویرایش».
// کپیِ verbatim از مسیر ثبت: اعتبارسنجی محصول/گزینه، قیمت واحد، مشمولیت تخفیف
// (فلگ محصول، وگرنه فلگ دسته) و محاسبهٔ بیرون‌بر. هیچ تخفیفی اینجا اعمال نمی‌شود.

type PosDb = ReturnType<typeof import('@/lib/supabase/server').supabaseAdmin>

export type PosPricing = {
  serverItems: any[]
  baseTotal: number
  takeawayTotal: number
  eligibleSubtotal: number
}

export async function pricePosItems(
  db: PosDb,
  items: any[]
): Promise<{ ok: true; data: PosPricing } | { ok: false; error: string; status?: number }> {
    const productIds = [...new Set(items.map((i: any) => i.product_id as string))]
    const optionIds = [
      ...new Set(items.filter((i: any) => i.option_id).map((i: any) => i.option_id as string)),
    ]

    const { data: products, error: prodErr } = await db
      .from('products')
      .select('id, name, price, is_active, is_available, coupon_eligible, takeaway_fee_id, categories(coupon_eligible, takeaway_fee_id)')
      .in('id', productIds)
    if (prodErr || !products) {
      console.error('[admin orders create] products:', prodErr)
      return { ok: false, error: 'خطا در ثبت سفارش', status: 500 }
    }
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))
const feeMap = await loadActiveFees(db, products)

    const { data: requiredGroups, error: reqErr } = await db
      .from('variant_groups')
      .select('id, product_id')
      .in('product_id', productIds)
      .eq('is_required', true)
    if (reqErr) {
      console.error('[admin orders create] groups:', reqErr)
      return { ok: false, error: 'خطا در ثبت سفارش', status: 500 }
    }

    let optionMap = new Map<string, any>()
    if (optionIds.length > 0) {
      const { data: options, error: optErr } = await db
        .from('variant_options')
        .select('id, group_id, name, price_modifier, is_available, variant_groups(product_id, name)')
        .in('id', optionIds)
      if (optErr || !options) {
        console.error('[admin orders create] options:', optErr)
        return { ok: false, error: 'خطا در ثبت سفارش', status: 500 }
      }
      optionMap = new Map<string, any>(options.map((o: any) => [o.id, o]))
    }

    // ---------- قیمت‌گذاری سمت سرور (بدون تخفیف) ----------
    const serverItems: any[] = []
    let baseTotal = 0
	let takeawayTotal = 0
    let eligibleSubtotal = 0

    for (const it of items) {
      const p = productMap.get(it.product_id)
      if (!p || !p.is_active || p.is_available === false) {
        return { ok: false, error: 'یکی از محصولات در دسترس نیست' }
      }

      let optionName: string | null = null
      let groupName: string | null = null
      let modifier = 0

      if (it.option_id) {
        const o = optionMap.get(it.option_id)
        const grp: any = o?.variant_groups
        if (!o || o.is_available === false || !grp || grp.product_id !== it.product_id) {
          return { ok: false, error: 'گزینه‌ی انتخاب‌شده نامعتبر است' }
        }
        modifier = Number(o.price_modifier) || 0
        optionName = o.name
        groupName = grp.name
      } else {
        const needsOption = (requiredGroups ?? []).some(
          (g: any) => g.product_id === it.product_id
        )
        if (needsOption) return { ok: false, error: `برای «${p.name}» انتخاب گزینه الزامی است` }
      }

      const unitPrice = it.option_id ? modifier : Number(p.price)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return { ok: false, error: 'قیمت نامعتبر است', status: 500 }

      const lineTotal = unitPrice * it.quantity
      baseTotal += lineTotal

      const eligible =
        p.coupon_eligible === true
          ? true
          : p.coupon_eligible === false
            ? false
            : p.categories?.coupon_eligible === false
              ? false
              : true
      if (eligible) eligibleSubtotal += lineTotal
const wantsTakeaway = it.takeaway === true
let takeawayFee = 0
let takeawayLabel: string | null = null
if (wantsTakeaway) {
  const f = feeForProduct(p, feeMap)
  if (!f) return { ok: false, error: `بیرون‌بر برای «${p.name}» در دسترس نیست` }
  takeawayFee = f.fee
  takeawayLabel = f.name
  takeawayTotal += f.fee * it.quantity
}
      serverItems.push({
        product_id: it.product_id,
        product_name: p.name,
        // 🎯 پچ ۵۰-هـ-د: پیام آمادهٔ این ردیف — در فیش آشپزخانه چاپ می‌شود
        line_note:
          typeof it.line_note === 'string' && it.line_note.trim()
            ? it.line_note.trim().slice(0, 120)
            : null,
        option_id: it.option_id ?? null,
        option_name: optionName,
        group_name: groupName,
        unit_price: unitPrice,
        quantity: it.quantity,
        takeaway: wantsTakeaway,
		takeaway_fee: takeawayFee,
		takeaway_label: takeawayLabel,
      })
    }

  return { ok: false, error: 'خطا در قیمت‌گذاری آیتم‌ها', status: 500 }
}
