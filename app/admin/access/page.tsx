import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۳ — مدیریت دسترسی ماژول‌ها در صفحهٔ «کاربران و دسترسی» ادغام شد؛
// این مسیر فقط لینک‌های قدیمی را به همان صفحه منتقل می‌کند
export default function AccessPage() {
  redirect('/admin/users')
}
