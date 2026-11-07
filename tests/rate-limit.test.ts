import { describe, it, expect, vi, afterEach } from 'vitest'
import { getClientIp, rateLimit, tooMany } from '../lib/rate-limit'

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://test.local/api', { headers })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('getClientIp', () => {
  it('اولین IP از x-forwarded-for (کلاینت واقعی پشت پروکسی)', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
  })

  it('فاصله‌ی اضافه در هدر نادیده گرفته می‌شود', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '  5.5.5.5 , 10.0.0.1' }))).toBe('5.5.5.5')
  })

  it('بدون forwarded → x-real-ip', () => {
    expect(getClientIp(req({ 'x-real-ip': '7.7.7.7' }))).toBe('7.7.7.7')
  })

  it('بدون هیچ هدری → unknown', () => {
    expect(getClientIp(req())).toBe('unknown')
  })
})

describe('rateLimit — پنجره‌ی لغزان', () => {
  // هر تست با name جدا تا bucketهای ماژول مشترک، تداخل نکنند
  it('تا سقف مجاز عبور می‌کند و بعد قفل می‌شود', () => {
    const r = req({ 'x-forwarded-for': '9.9.9.9' })
    const a = rateLimit(r, 't1', 3, 60_000)
    const b = rateLimit(r, 't1', 3, 60_000)
    const c = rateLimit(r, 't1', 3, 60_000)
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true])
    expect([a.remaining, b.remaining, c.remaining]).toEqual([2, 1, 0])

    const d = rateLimit(r, 't1', 3, 60_000)
    expect(d.ok).toBe(false)
    expect(d.remaining).toBe(0)
    expect(d.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(d.retryAfterSec).toBeLessThanOrEqual(60)
  })

  it('extraKey متفاوت → bucket جدا (دو دستگاه مستقل)', () => {
    const r = req({ 'x-forwarded-for': '9.9.9.9' })
    expect(rateLimit(r, 't2', 1, 60_000, 'device-a').ok).toBe(true)
    expect(rateLimit(r, 't2', 1, 60_000, 'device-a').ok).toBe(false)
    expect(rateLimit(r, 't2', 1, 60_000, 'device-b').ok).toBe(true)
  })

  it('نام متفاوت → bucket جدا', () => {
    const r = req({ 'x-forwarded-for': '9.9.9.9' })
    expect(rateLimit(r, 't3-a', 1, 60_000).ok).toBe(true)
    expect(rateLimit(r, 't3-a', 1, 60_000).ok).toBe(false)
    expect(rateLimit(r, 't3-b', 1, 60_000).ok).toBe(true)
  })

  it('IP متفاوت → bucket جدا', () => {
    expect(rateLimit(req({ 'x-forwarded-for': '8.8.8.8' }), 't4', 1, 60_000).ok).toBe(true)
    expect(rateLimit(req({ 'x-forwarded-for': '8.8.8.8' }), 't4', 1, 60_000).ok).toBe(false)
    expect(rateLimit(req({ 'x-forwarded-for': '8.8.4.4' }), 't4', 1, 60_000).ok).toBe(true)
  })

  it('پایان پنجره → شمارنده صفر می‌شود', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'))
    const r = req({ 'x-forwarded-for': '6.6.6.6' })
    expect(rateLimit(r, 't5', 2, 60_000).ok).toBe(true)
    expect(rateLimit(r, 't5', 2, 60_000).ok).toBe(true)
    expect(rateLimit(r, 't5', 2, 60_000).ok).toBe(false)

    vi.setSystemTime(new Date('2026-11-07T10:01:01Z')) // 61 ثانیه بعد
    const after = rateLimit(r, 't5', 2, 60_000)
    expect(after.ok).toBe(true)
    expect(after.remaining).toBe(1)
  })
})

describe('tooMany — پاسخ ۴۲۹', () => {
  it('status و Retry-After و بدنه درست', async () => {
    const res = tooMany({ ok: false, remaining: 0, retryAfterSec: 37 })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('37')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body.error).toContain('تعداد درخواست')
  })
})
