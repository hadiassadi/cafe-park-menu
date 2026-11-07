// ریتم‌سنج درون‌حافظه‌ای (پنجره‌ی لغزان) — بدون نیاز به سرویس خارجی
// توجه: در محیط سرورلس (Vercel) هر instance حافظه‌ی جداگانه دارد؛
// این لایه «بازدارنده» است و جلوی اسپم و سوءاستفاده‌ی برنامه‌ای را می‌گیرد،
// نه یک قفل مطلق سراسری. برای قفل سخت‌گیرانه‌تر باید از سرویس اشتراکی استفاده کرد.

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()

// سقف حافظه؛ اگر کلیدهای زیادی انباشته شد، قدیمی‌های خالی پاک می‌شوند
const MAX_BUCKETS = 10_000

export function getClientIp(req: Request): string {
  // روی Vercel مقدار x-forwarded-for همیشه ست می‌شود؛ اولین IP، کلاینت واقعی است
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * مثال: rateLimit(req, 'orders-post', 30, 60_000)
 * یعنی حداکثر ۳۰ درخواست در هر دقیقه برای هر کلید (IP + اختیاری شناسه‌ی دستگاه)
 */
export function rateLimit(
  req: Request,
  name: string,
  limit: number,
  windowMs: number,
  extraKey?: string
): RateLimitResult {
  const ip = getClientIp(req)
  const key = `${name}:${extraKey ?? ''}:${ip}`
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      const alive = b.hits.some((t) => now - t < windowMs)
      if (!alive) buckets.delete(k)
      if (buckets.size <= MAX_BUCKETS) break
    }
  }

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    const oldest = bucket.hits[0] ?? now
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 }
}

export function tooMany(res: RateLimitResult): Response {
  return Response.json(
    { error: 'تعداد درخواست‌های شما زیاد است؛ لطفاً کمی بعد دوباره تلاش کنید' },
    {
      status: 429,
      headers: {
        'Retry-After': String(res.retryAfterSec),
        'Cache-Control': 'no-store',
      },
    }
  )
}
