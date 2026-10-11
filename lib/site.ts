// lib/site.ts
// آدرس اصلی سایت؛ یک جا برای متا، robots، sitemap و داده ساختاریافته.
// وقتی دامنه اختصاصی گرفتی، در Vercel (Settings > Environment Variables)
// متغیر NEXT_PUBLIC_SITE_URL را با آدرس جدید (مثلاً https://cafepark.ir) بگذار.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://cafe-park-menu.vercel.app'
).replace(/\/+$/, '')
