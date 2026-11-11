// lib/backup-sections.ts
// بخش‌بندی بکاپ برای چک‌لیست زندهٔ پنل ادمین (پچ ۴۹).
// ترتیب جداول داخل بخش‌ها طوری است که ترتیب کل حاصل، امن از نظر کلیدهای خارجی بماند
// (مصرف‌کنندهٔ اصلی بازگردانی، ترتیب کلیدهای object «tables» را رعایت می‌کند).

export type BackupSection = {
  key: string
  label: string
  tables: readonly string[]
}

export const BACKUP_SECTIONS: BackupSection[] = [
  { key: 'core', label: 'پایه و تنظیمات', tables: ['settings', 'club_settings', 'tables', 'cancellation_reasons'] },
  { key: 'branding', label: 'تم‌ها و جملات', tables: ['themes', 'quotes'] },
  {
    key: 'catalog',
    label: 'کاتالوگ (دسته‌ها، محصولات، میزها)',
    tables: ['categories', 'organizations', 'coupons', 'products', 'variant_groups', 'variant_options', 'takeaway_fees'],
  },
  {
    key: 'customers',
    label: 'مشتریان و باشگاه',
    tables: ['organization_members', 'customers', 'membership_requests', 'push_subscriptions'],
  },
  { key: 'orders', label: 'سفارش‌ها و پرداخت‌ها', tables: ['orders', 'order_payments', 'order_refunds'] },
  { key: 'logs', label: 'گزارش‌های سیستمی', tables: ['redemption_logs', 'club_settings_log'] },
]

export const STORAGE_SECTION_KEY = 'storage'
export const STORAGE_SECTION_LABEL = 'فایل‌های رسانه (تصاویر، رسیدها، فونت‌ها)'

// bucketهای Storage — منبع واحد برای بکاپ و بازگردانی
export const STORAGE_BUCKETS = ['product-images', 'receipts', 'theme-fonts'] as const
