// lib/site.ts
// آدرس اصلی سایت؛ یک جا برای متا، robots، sitemap و داده ساختاریافته.
// وقتی دامنه اختصاصی گرفتی، در Vercel (Settings > Environment Variables)
// متغیر NEXT_PUBLIC_SITE_URL را با آدرس جدید (مثلاً https://cafepark.ir) بگذار.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://cafe-park-menu.vercel.app'
).replace(/\/+$/, '')

// 🎯 پچ ۵۰-هـ-وِی: آدرس سایت برای callback درگاه پرداخت.
// اول env؛ اگر ست نشده بود (خطای «خطای پیکربندی سرور» می‌ساخت)، از هدرهای
// درخواستِ همان مرورگر/پروکسی می‌سازیم — در استقرار واقعی همیشه درست است.
export function resolveRequestOrigin(req: {
  headers: Headers
  nextUrl?: { origin: string }
}): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/+$/, '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (host) {
    const proto =
      req.headers.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`.replace(/\/+$/, '')
  }
  return req.nextUrl?.origin ?? SITE_URL
}
