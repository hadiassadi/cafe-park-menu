import { OpRole, roleAllowsPath } from './role-matrix'

// 🎯 پچ ۶۰ — رجیستری ماژول‌های پنل: منبع واحد برای صفحهٔ «دسترسی ماژول‌ها»،
// فیلتر منوی سایدبار و گیت ماژولار پروکسی.
// خالص و بدون وابستگی سرور تا هم در Edge (proxy.ts) و هم در کلاینت (layout)
// و هم در گاردهای سرور استفاده شود.
// ⚠️ هر بخش جدیدِ پنل باید همین‌جا اضافه شود تا در صفحهٔ دسترسی‌ها ظاهر شود.

export type AdminModuleDef = {
  href: string
  label: string
  icon: string
  group: string
}

export const ADMIN_MODULES: AdminModuleDef[] = [
  // عملیات روزانه
  { href: '/admin', label: 'داشبورد', icon: '🏠', group: 'عملیات روزانه' },
  { href: '/admin/orders', label: 'سفارش‌ها', icon: '🛒', group: 'عملیات روزانه' },
  { href: '/admin/orders/new', label: 'ثبت سفارش حضوری', icon: '➕', group: 'عملیات روزانه' },
  { href: '/admin/shifts', label: 'شیفت‌ها', icon: '⏱', group: 'عملیات روزانه' },
  { href: '/admin/accounting', label: 'حسابداری', icon: '🧮', group: 'عملیات روزانه' },
  { href: '/admin/customers', label: 'مشتریان', icon: '👥', group: 'عملیات روزانه' },
  { href: '/admin/users', label: 'کاربران و دسترسی', icon: '🔐', group: 'عملیات روزانه' },
  { href: '/admin/access', label: 'دسترسی ماژول‌ها', icon: '🧩', group: 'عملیات روزانه' },
  // کاتالوگ و منو
  { href: '/admin/products', label: 'محصولات', icon: '☕', group: 'کاتالوگ و منو' },
  { href: '/admin/categories', label: 'دسته‌ها', icon: '📂', group: 'کاتالوگ و منو' },
  { href: '/admin/tables', label: 'میزها', icon: '🪑', group: 'کاتالوگ و منو' },
  { href: '/admin/themes', label: 'تم‌ها', icon: '🎨', group: 'کاتالوگ و منو' },
  { href: '/admin/quotes', label: 'جملات', icon: '💬', group: 'کاتالوگ و منو' },
  // باشگاه و وفاداری
  { href: '/admin/memberships', label: 'باشگاه مشتریان', icon: '🎓', group: 'باشگاه و وفاداری' },
  { href: '/admin/settings/grades', label: 'گرید مشتریان', icon: '🏆', group: 'باشگاه و وفاداری' },
  { href: '/admin/settings/subscriptions', label: 'اشتراک ماهیانه', icon: '⭐', group: 'باشگاه و وفاداری' },
  { href: '/admin/coupons', label: 'کد تخفیف', icon: '🎟️', group: 'باشگاه و وفاداری' },
  { href: '/admin/settings/club', label: 'قوانین اعتبار', icon: '🛡️', group: 'باشگاه و وفاداری' },
  // کیف پول
  { href: '/admin/wallet', label: 'کیف پول مشتریان', icon: '👛', group: 'کیف پول' },
  // گزارش‌ها
  { href: '/admin/reports/sales', label: 'گزارش فروش', icon: '💰', group: 'گزارش‌ها' },
  { href: '/admin/cancellations', label: 'آمار لغوها', icon: '📊', group: 'گزارش‌ها' },
  { href: '/admin/cancellation-reasons', label: 'دلایل لغو', icon: '🚫', group: 'گزارش‌ها' },
  // سیستم
  { href: '/admin/settings', label: 'تنظیمات', icon: '⚙️', group: 'سیستم' },
  { href: '/admin/settings/payment', label: 'تنظیمات پرداخت', icon: '💳', group: 'سیستم' },
  { href: '/admin/settings/sms', label: 'تنظیمات پیامک', icon: '📱', group: 'سیستم' },
  { href: '/admin/backup', label: 'پشتیبان‌گیری', icon: '💾', group: 'سیستم' },
]

// 🎯 پیش‌فرض هر نقش از ماتریس پچ ۵۶ می‌آید — تا منو و گیت‌های موجود همیشه هم‌نظر بمانند
export function defaultPathsForRole(role: OpRole): string[] {
  if (role === 'owner') return ADMIN_MODULES.map((m) => m.href)
  return ADMIN_MODULES.filter((m) => roleAllowsPath(role, m.href)).map(
    (m) => m.href
  )
}

// لیست ذخیره‌شدهٔ کاربر را به مسیرهای شناخته‌شده محدود می‌کند — بدون افزودن داشبورد
// (لیست خالی یعنی «پیش‌فرض نقش» و ماتریس نقش حاکم است)
export function sanitizeAllowedPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const known = new Set(ADMIN_MODULES.map((m) => m.href))
  const out: string[] = []
  for (const p of raw) {
    if (typeof p === 'string' && known.has(p) && !out.includes(p)) out.push(p)
  }
  return out
}

// برای ذخیره در صفحهٔ دسترسی‌ها: داشبورد همیشه داخل لیست می‌ماند
export function normalizeAllowedPaths(raw: unknown): string[] {
  const out = sanitizeAllowedPaths(raw)
  if (!out.includes('/admin')) out.unshift('/admin')
  return out
}

// 🎯 تصمیم واحد گیت ماژولار — منو، صفحات، actionها و پروکسی همه از این استفاده می‌کنند:
//   مالک → همه‌چیز؛ داشبورد و ورود → همیشه باز؛
//   لیست دلخواهِ ثبت‌شده → ملاک نهایی؛ در غیر این صورت پیش‌فرض نقش
//
// 🎯 پچ ۶۰-و (فیکس بحرانی): تیکِ «داشبورد» (مسیر '/admin') فقط خودِ صفحهٔ داشبورد
// را باز می‌کند، نه کل درخت /admin/* — چون چک پیشوندیِ startsWith('/admin/') روی
// هر صفحهٔ دیگری هم true می‌داد و عملاً همهٔ ماژول‌ها را برای همه باز می‌کرد.
// مسیر '/admin' داخل لیست پس از چکِ exactِ داشبورد، در تطبیق پیشوندی نادیده گرفته می‌شود.
export function accessAllowsPath(
  role: OpRole,
  allowedPaths: string[] | null | undefined,
  path: string
): boolean {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (clean === '/admin' || clean === '/admin/login') return true
  if (role === 'owner') return true
  if (allowedPaths && allowedPaths.length > 0) {
    return allowedPaths.some(
      (p) =>
        p !== '/admin' && (clean === p || clean.startsWith(p + '/'))
    )
  }
  return roleAllowsPath(role, clean)
}
