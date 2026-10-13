import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

type CartItem = {
  product_id: string
  quantity: number
  unit_price: number
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

// ✅ بررسی واجد شرایط بودن محصول
function isEligible(
  product: ProductInfo,
  category: CategoryInfo | undefined
): boolean {
  // اولویت ۱: تنظیمات محصول
  if (product.coupon_eligible === true) return true
  if (product.coupon_eligible === false) return false

  // اولویت ۲: از دسته‌بندی ارث ببر
  if (category) {
    if (category.coupon_eligible === false) return false
    if (category.coupon_eligible === true) return true
  }

  // پیش‌فرض: شامل تخفیف
  return true
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, items, subtotal } = body

    if (!code || !Array.isArray(items) || typeof subtotal !== 'number') {
      return NextResponse.json(
        { error: 'اطلاعات ناقص است' },
        { status: 400 }
      )
    }

    const cleanCode = String(code).trim().toUpperCase()
    const db = await supabaseServer()

    // ─── خوندن کوپن ───
    const { data: coupon, error } = await db
      .from('coupons')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle()

    if (error || !coupon) {
      return NextResponse.json(
        { error: 'کد تخفیف معتبر نیست' },
        { status: 404 }
      )
    }

    // ─── اعتبارسنجی کوپن ───
    if (!coupon.is_active) {
      return NextResponse.json(
        { error: 'این کد تخفیف غیرفعال شده است' },
        { status: 400 }
      )
    }

    const now = new Date()

    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return NextResponse.json(
        { error: 'این کد تخفیف هنوز فعال نشده است' },
        { status: 400 }
      )
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return NextResponse.json(
        { error: 'این کد تخفیف منقضی شده است' },
        { status: 400 }
      )
    }

    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json(
        { error: 'ظرفیت استفاده از این کد تخفیف پر شده است' },
        { status: 400 }
      )
    }

    // ✅ چک حداقل مبلغ سفارش (روی جمع کل)
    if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
      return NextResponse.json(
        {
          error: `حداقل مبلغ سفارش برای این کد ${coupon.min_order_amount.toLocaleString('fa-IR')} تومان است`,
        },
        { status: 400 }
      )
    }

    // ✅ چک حداکثر مبلغ سفارش (روی جمع کل)
    if (coupon.max_order_amount && subtotal > coupon.max_order_amount) {
      return NextResponse.json(
        {
          error: `این کد فقط برای سفارش‌های زیر ${coupon.max_order_amount.toLocaleString('fa-IR')} تومان است`,
        },
        { status: 400 }
      )
    }

    // ─── محاسبه eligible_subtotal ───
    const productIds = Array.from(
      new Set(items.map((i: CartItem) => i.product_id))
    )

    // خوندن محصولات
    const { data: products, error: productsError } = await db
      .from('products')
      .select('id, category_id, coupon_eligible')
      .in('id', productIds)

    if (productsError || !products) {
      return NextResponse.json(
        { error: 'خطا در خواندن اطلاعات محصولات' },
        { status: 500 }
      )
    }

    // خوندن دسته‌بندی‌های مربوطه
    const categoryIds = Array.from(
      new Set(products.map((p) => p.category_id))
    )

    const { data: categories, error: categoriesError } = await db
      .from('categories')
      .select('id, coupon_eligible')
      .in('id', categoryIds)

    if (categoriesError) {
      return NextResponse.json(
        { error: 'خطا در خواندن اطلاعات دسته‌بندی' },
        { status: 500 }
      )
    }

    // ساخت map برای دسترسی سریع
    const productMap = new Map<string, ProductInfo>(
      products.map((p) => [p.id, p as ProductInfo])
    )
    const categoryMap = new Map<string, CategoryInfo>(
      (categories || []).map((c) => [c.id, c as CategoryInfo])
    )

        // ─── محاسبه جمع واجد و غیرواجد ───
    let eligibleSubtotal = 0
    let ineligibleSubtotal = 0
    const eligibleProductIds: string[] = []   // ✅ جدید

    for (const item of items as CartItem[]) {
      const product = productMap.get(item.product_id)
      if (!product) continue

      const category = categoryMap.get(product.category_id)
      const eligible = isEligible(product, category)

      const itemTotal = item.unit_price * item.quantity

      if (eligible) {
        eligibleSubtotal += itemTotal
        if (!eligibleProductIds.includes(item.product_id)) {
          eligibleProductIds.push(item.product_id)
        }
      } else {
        ineligibleSubtotal += itemTotal
      }
    }

    // اگه هیچ محصولی واجد نبود
    if (eligibleSubtotal === 0) {
      return NextResponse.json(
        {
          error:
            'هیچ‌کدام از اقلام سبد شامل تخفیف نمی‌شن. کد تخفیف قابل اعمال نیست',
        },
        { status: 400 }
      )
    }

    // ─── محاسبه تخفیف (فقط روی eligible_subtotal) ───
    let discount = 0

    if (coupon.discount_type === 'percent') {
      discount = (eligibleSubtotal * coupon.discount_value) / 100
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount
      }
    } else {
      discount = coupon.discount_value
    }

    // تخفیف نباید بیشتر از مبلغ واجد باشه
    if (discount > eligibleSubtotal) {
      discount = eligibleSubtotal
    }

    discount = Math.round(discount)
    const finalTotal = subtotal - discount

        return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
      discount,
      eligibleSubtotal: Math.round(eligibleSubtotal),
      ineligibleSubtotal: Math.round(ineligibleSubtotal),
      eligibleProductIds,   // ✅ جدید
      finalTotal: Math.round(finalTotal),
    })
  } catch (err) {
    console.error('[coupon validate] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}