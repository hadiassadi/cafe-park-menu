// lib/admin/dashboard-widgets.ts
// 🎯 پچ ۷۲ — داشبورد قابل تنظیم برای هر کاربر
//   هر «ویجت» = یک بخش آماری = یک تب مستقل در داشبورد. کاربر تیک می‌زند
//   کدام بخش‌ها برای او باشند؛ انتخابش در جدول dashboard_prefs برای حساب
//   خودش ذخیره می‌شود (نه per-browser). ترتیب رجیستری = ترتیب اولویت
//   نمایش تب‌ها (اولویت‌دارترها اول).
//   کارت‌های هیرو (امروز/این ماه) همیشه بالای داشبورد هستند و مشمول
//   تیک‌ها نیستند — استاندارد پایهٔ هر داشبورد.
// 🎯 پچ ۷۶ — دو ویجت جدید:
//   • shift  «شیفت باز جاری» — وضعیت شیفت جاری از API رسمی /api/admin/shifts
//     + دکمهٔ باز/بستن (embed خودِ ShiftBadge). برای همهٔ نقش‌ها — هر که شیفت
//     می‌گیرد باید وضعیت شیفتش را ببیند.
//   • cancels «لغوهای امروز» — سفارش‌های لغوشدهٔ امروز (به وقت تهران) با
//     دلیل/یادداشت/مبلغ. دادهٔ حساس کسب‌وکار → فقط نقش‌های مالی (مالک/مدیر/
//     سفارشیِ دارای گزارش فروش).
import { accessAllowsPath } from './modules'
import { OpRole } from './role-matrix'

export type DashboardWidgetId =
  | 'cash'
  | 'shift'
  | 'cancels'
  | 'charts'
  | 'top'
  | 'recent'
  | 'tools'

export type DashboardWidgetDef = {
  id: DashboardWidgetId
  label: string
  icon: string
  description: string
  /** فقط نقش‌های دارای دسترسی مالی این ویجت را می‌بینند (صندوق/نمودار/پرفروش) */
  finance?: boolean
  /** فقط مالک */
  ownerOnly?: boolean
}

// ⚠️ ترتیب این آرایه = ترتیب اولویت تب‌ها (اولویت‌دارترها اول):
// صندوق و بانک → شیفت باز جاری → لغوهای امروز → نمودارها → پرفروش‌ها →
// سفارش‌های اخیر → ابزارها
export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  {
    id: 'cash',
    label: 'صندوق و بانک',
    icon: '💵',
    description: 'موجودی فعلی صندوق و حساب‌های بانکی از دفتر کل + ورودی امروز',
    finance: true,
  },
  {
    id: 'shift',
    label: 'شیفت باز جاری',
    icon: '⏱',
    description:
      'وضعیت شیفت در حال اجرا: شروع، تنخواه، فروش به تفکیک روش، سفارش باز و نقدی موردانتظار — با دکمهٔ باز/بستن شیفت',
  },
  {
    id: 'cancels',
    label: 'لغوهای امروز',
    icon: '❌',
    description:
      'سفارش‌های لغوشدهٔ امروز به وقت تهران، با دلیل ثبت‌شده، یادداشت و جمع مبلغ',
    finance: true,
  },
  {
    id: 'charts',
    label: 'نمودارها و مقایسه',
    icon: '📈',
    description: 'روند فروش ۷ روزه و ۶ ماهه + مقایسه با ماه قبل',
    finance: true,
  },
  {
    id: 'top',
    label: 'پرفروش‌ترین محصولات',
    icon: '⭐',
    description: '۲۰ محصول پرفروش ۳۰ روز اخیر',
    finance: true,
  },
  {
    id: 'recent',
    label: 'سفارش‌های اخیر',
    icon: '🧾',
    description: 'مالک/مدیر: همهٔ سفارش‌ها — بقیه: سفارش‌های شخصی خودشان',
  },
  {
    id: 'tools',
    label: 'ابزارهای نگهداری',
    icon: '🧹',
    description: 'پاک‌سازی و ممیزی سفارش‌ها',
    ownerOnly: true,
  },
]

// آیا این کاربر اجازهٔ دیدن این ویجت را دارد؟
export function widgetAllowedFor(
  w: DashboardWidgetDef,
  role: OpRole,
  canSeeFinance: boolean
): boolean {
  if (w.ownerOnly) return role === 'owner'
  if (w.finance) return canSeeFinance
  return true
}

// ویجت‌های در دسترسِ یک نقش — به ترتیب اولویت رجیستری
export function widgetsForRole(
  role: OpRole,
  canSeeFinance: boolean
): DashboardWidgetDef[] {
  return DASHBOARD_WIDGETS.filter((w) =>
    widgetAllowedFor(w, role, canSeeFinance)
  )
}

// چیدمان پیش‌فرض وقتی کاربر هنوز چیزی ذخیره نکرده — همان ترتیب اولویت
export function defaultWidgetsFor(
  role: OpRole,
  canSeeFinance: boolean
): DashboardWidgetId[] {
  return widgetsForRole(role, canSeeFinance).map((w) => w.id)
}

// دسترسی مالی — همان منطق داشبورد: مالک/مدیر یا تیک «گزارش فروش» در دسترسی سفارشی
export function canSeeFinanceFor(
  role: OpRole,
  allowedPaths: string[] | null
): boolean {
  return (
    role === 'owner' ||
    role === 'manager' ||
    (Array.isArray(allowedPaths) &&
      allowedPaths.length > 0 &&
      accessAllowsPath(role, allowedPaths, '/admin/reports/sales'))
  )
}

// پالایش انتخاب ذخیره‌شدهٔ کاربر: فقط شناسه‌های مجاز برای نقش خودش، بدون تکرار
export function sanitizeWidgets(
  raw: unknown,
  role: OpRole,
  canSeeFinance: boolean
): DashboardWidgetId[] {
  const allowed = new Set(
    widgetsForRole(role, canSeeFinance).map((w) => w.id)
  )
  if (!Array.isArray(raw)) return defaultWidgetsFor(role, canSeeFinance)
  const out: DashboardWidgetId[] = []
  for (const id of raw) {
    if (
      typeof id === 'string' &&
      allowed.has(id as DashboardWidgetId) &&
      !out.includes(id as DashboardWidgetId)
    ) {
      out.push(id as DashboardWidgetId)
    }
  }
  return out
}
