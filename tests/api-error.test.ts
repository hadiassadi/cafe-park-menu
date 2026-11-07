import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiError } from '../lib/api-error'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiError', () => {
  it('وضعیت و پیام سفارشی', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = apiError(new Error('boom'), 'درخواست نامعتبر است', 400)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'درخواست نامعتبر است' })
    expect(spy).toHaveBeenCalled()
  })

  it('پیش‌فرض: پیام عمومی و وضعیت 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = apiError('خطای رشته‌ای هم قابل ثبت است')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'خطای غیرمنتظره' })
  })
})
