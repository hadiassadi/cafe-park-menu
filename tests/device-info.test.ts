import { describe, it, expect } from 'vitest'
import { parseDeviceLabel } from '../lib/device-info'

describe('parseDeviceLabel', () => {
  it('آیفون را تشخیص می‌دهد', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    expect(parseDeviceLabel(ua)).toBe('آیفون — سافاری')
  })

  it('اندروید با نسخه و کروم را تشخیص می‌دهد', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
    expect(parseDeviceLabel(ua)).toBe('اندروید 14 — کروم')
  })

  it('مرورگر سامسونگ را از کروم جدا می‌کند', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/22.0 Chrome/111.0.0.0 Mobile Safari/537.36'
    expect(parseDeviceLabel(ua)).toBe('اندروید 13 — مرورگر سامسونگ')
  })

  it('ویندوز با کروم را تشخیص می‌دهد', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseDeviceLabel(ua)).toBe('ویندوز — کروم')
  })

  it('ویندوز با اج را تشخیص می‌دهد', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(parseDeviceLabel(ua)).toBe('ویندوز — Edge')
  })

  it('مک با سافاری را تشخیص می‌دهد', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    expect(parseDeviceLabel(ua)).toBe('مک — سافاری')
  })

  it('آیپد را تشخیص می‌دهد', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    expect(parseDeviceLabel(ua)).toBe('آیپد — سافاری')
  })

  it('ورودی خالی برچسب نامشخص می‌دهد', () => {
    expect(parseDeviceLabel('')).toBe('دستگاه نامشخص')
    expect(parseDeviceLabel('   ')).toBe('دستگاه نامشخص')
  })

  it('user-agent ناشناخته ولی معتبر، دستگاه نامشخص می‌دهد نه خطا', () => {
    expect(parseDeviceLabel('WeirdBot/1.0')).toBe('دستگاه نامشخص')
  })
})
