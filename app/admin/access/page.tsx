import AccessManager from './AccessManager'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۰ — صفحهٔ «دسترسی ماژول‌ها»: مدیر برای هر کاربر تیک می‌زند کدام بخش‌ها
// در منویش دیده شود؛ گیت سرور (پروکسی + گاردهای نقش) همان لیست را اعمال می‌کند
// (مجوز این صفحه در پروکسی و API با requirePathAccess('/admin/access') کنترل می‌شود)
export default function AccessPage() {
  return <AccessManager />
}
