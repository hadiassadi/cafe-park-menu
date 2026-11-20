// 🎯 پچ ۵۶ — فاز ۴-ب: ماتریس دسترسی نقش‌های پنل (الگوی فصل اول پارسیان)
// این فایل خالص است (بدون وابستگی سرور) تا هم در layout کلاینت و هم در
// گاردهای سرور استفاده شود.
//
// ماتریس (پیش‌فرض: بدترین حالت — staff):
//   مالک (owner): همهٔ بخش‌ها
//   مدیر (manager): همه به‌جز حسابداری، کاربران و دسترسی، تنظیمات
//     (اصلی/پرداخت/پیامک)، پشتیبان‌گیری و تم‌ها
//   صندوق‌دار (cashier) و کارمند (staff): فقط عملیات روزانه — سفارش‌ها،
//     ثبت سفارش، شیفت‌ها، مشتریان، آمار لغوها و دلایل لغو

export type OpRole = 'owner' | 'manager' | 'cashier' | 'staff'

export const ROLE_LABEL: Record<OpRole, string> = {
  owner: 'مالک',
  manager: 'مدیر',
  cashier: 'صندوق‌دار',
  staff: 'کارمند',
}

export const OP_ROLES: OpRole[] = ['owner', 'manager', 'cashier', 'staff']

// فقط خود صفحهٔ تنظیمات — زیرصفحه‌های گرید/اشتراک/قوانین در گروه وفاداری
// برای مدیر باز می‌مانند
const MANAGER_DENY_EXACT = ['/admin/settings', '/admin/themes']
const MANAGER_DENY_PREFIX = [
  '/admin/accounting',
  '/admin/users',
  '/admin/settings/payment',
  '/admin/settings/sms',
  '/admin/backup',
]

const CASHIER_ALLOW = [
  '/admin/orders', // شامل /admin/orders/new (POS)
  '/admin/shifts',
  '/admin/customers',
  '/admin/cancellations',
  '/admin/cancellation-reasons',
]

export function roleAllowsPath(role: OpRole, path: string): boolean {
  if (role === 'owner') return true
  if (path === '/admin' || path === '/admin/login') return true
  if (role === 'manager') {
    if (MANAGER_DENY_EXACT.includes(path)) return false
    if (MANAGER_DENY_PREFIX.some((d) => path.startsWith(d))) return false
    return true
  }
  // cashier و staff
  return CASHIER_ALLOW.some((a) => path === a || path.startsWith(a + '/'))
}
