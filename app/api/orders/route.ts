import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type CartItem = {
  product_id: string
  product_name: string
  option_id: string | null
  option_name: string | null
  group_name: string | null
  unit_price: number
  quantity: number
}

type ProductInfo = {
  id: string
  category_id: string
  coupon_eligible: boolean | null
}

type CategoryInfo = {
  id: string
  coupon_eligible: boolean | null
}

function isEligible(
  product: ProductInfo,
  category: CategoryInfo | undefined
): boolean {
  if (product.coupon_eligible === true) return true
  if (product.coupon_eligible === false) return false

  if (category) {
    if (category.coupon_eligible === false) return false
    if (category.coupon_eligible === true) return true
  }

  return true
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customer_name,
      customer_phone,
      table_number,
      note,
      items,
      subtotal,
      coupon_code,
    } = body

    if (!customer_name || !customer_phone || !items?.length) {
      return NextResponse.json(
        { error: 'اطلاعات ناقص است' },
        { status: 400 }
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) {
      return NextResponse.json(
        { error: 'تنظیمات سرور ناقص است' },
        { status: 500 }
      )
    }

    const db = createClient(url, key, { auth: { persistSession: false } })

    // ─── محاسبه تخفیف ───
    let couponDiscount = 0
    let validCoupon: any = null
    let eligibleSubtotal = Number(subtotal)
    let ineligibleSubtotal = 0
    const finalSubtotal = Number(subtotal)

    if (coupon_code) {
      const cleanCode = String(coupon_code).trim().toUpperCase()

      const { data: coupon } = await db
        .from('coupons')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle()

      if (coupon && coupon.is_active) {
        const now = new Date()
        const isNotExpired =
          !coupon.valid_until || new Date(coupon.valid_until) > now
        const isStarted =
          !coupon.valid_from || new Date(coupon.valid_from) <= now
        const hasCapacity =
          !coupon.max_uses || coupon.used_count < coupon.max_uses
        const meetsMin =
          !coupon.min_order_amount ||
          Number(subtotal) >= coupon.min_order_amount
        const meetsMax =
          !coupon.max_order_amount ||
          Number(subtotal) <= coupon.max_order_amount

        if (isNotExpired && isStarted && hasCapacity && meetsMin && meetsMax) {
          // ─── محاسبه eligible_subtotal ───
          const productIds = Array.from(
            new Set((items as CartItem[]).map((i) => i.product_id))
          )

          const { data: products } = await db
            .from('products')
            .select('id, category_id, coupon_eligible')
            .in('id', productIds)

          if (products) {
            const categoryIds = Array.from(
              new Set(products.map((p) => p.category_id))
            )
            const { data: categories } = await db
              .from('categories')
              .select('id, coupon_eligible')
              .in('id', categoryIds)

            const productMap = new Map<string, ProductInfo>(
              products.map((p) => [p.id, p as ProductInfo])
            )
            const categoryMap = new Map<string, CategoryInfo>(
              (categories || []).map((c) => [c.id, c as CategoryInfo])
            )

            eligibleSubtotal = 0
            ineligibleSubtotal = 0

            for (const item of items as CartItem[]) {
              const product = productMap.get(item.product_id)
              if (!product) continue

              const category = categoryMap.get(product.category_id)
              const eligible = isEligible(product, category)

              const itemTotal = item.unit_price * item.quantity

              if (eligible) {
                eligibleSubtotal += itemTotal
              } else {
                ineligibleSubtotal += itemTotal
              }
            }

                        // ─── محاسبه تخفیف ───
            if (eligibleSubtotal > 0) {
              if (coupon.discount_type === 'percent') {
                couponDiscount =
                  (eligibleSubtotal * coupon.discount_value) / 100
                if (
                  coupon.max_discount &&
                  couponDiscount > coupon.max_discount
                ) {
                  couponDiscount = coupon.max_discount
                }
              } else {
                couponDiscount = coupon.discount_value
              }

              if (couponDiscount > eligibleSubtotal) {
                couponDiscount = eligibleSubtotal
              }

              couponDiscount = Math.round(couponDiscount)
              validCoupon = coupon

              // ✅ محاسبه سهم هر آیتم از تخفیف
              let remaining = couponDiscount
              const eligibleItems: number[] = []

              ;(items as CartItem[]).forEach((item, i) => {
                const product = productMap.get(item.product_id)
                if (!product) return
                const category = categoryMap.get(product.category_id)
                const eligible = isEligible(product, category)
                if (eligible) eligibleItems.push(i)
              })

              eligibleItems.forEach((itemIdx, idx) => {
                const item = (items as CartItem[])[itemIdx]
                const itemTotal = item.unit_price * item.quantity
                let itemDiscount: number

                if (idx === eligibleItems.length - 1) {
                  // آخرین آیتم: باقی‌مونده رو بگیر (جبران گرد کردن)
                  itemDiscount = remaining
                } else {
                  itemDiscount = Math.round(
                    (itemTotal / eligibleSubtotal) * couponDiscount
                  )
                  remaining -= itemDiscount
                }

                ;(items as any)[itemIdx].discount_amount = Math.max(
                  0,
                  itemDiscount
                )
              })

              // برای آیتم‌های غیرواجد، تخفیف صفر
              ;(items as CartItem[]).forEach((item, i) => {
                if (!eligibleItems.includes(i)) {
                  ;(items as any)[i].discount_amount = 0
                }
              })
            }
          }
        }
      }
    }

    // مبلغ نهایی = جمع کل - تخفیف
    const grandTotal = Number(subtotal) - couponDiscount

    // ─── ثبت سفارش ───
    const { data: order, error } = await db
      .from('orders')
      .insert({
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        table_number: table_number || null,
        note: note || null,
        items,
        subtotal: grandTotal,
        original_subtotal: Number(subtotal),
        coupon_code: validCoupon?.code || null,
        coupon_discount: couponDiscount,
        eligible_subtotal: Math.round(eligibleSubtotal),
        ineligible_subtotal: Math.round(ineligibleSubtotal),
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[order create] error:', error)
      return NextResponse.json(
        { error: 'خطا در ثبت سفارش' },
        { status: 500 }
      )
    }

    // ─── افزایش used_count ───
    if (validCoupon) {
      await db
        .from('coupons')
        .update({ used_count: validCoupon.used_count + 1 })
        .eq('id', validCoupon.id)
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[order create] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}