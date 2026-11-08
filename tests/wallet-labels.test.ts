import { describe, it, expect } from 'vitest'
import {
  walletTxKindLabel,
  walletTxStatusLabel,
  walletTxKindIcon,
} from '../lib/wallet/labels'

describe('برچسب‌های تراکنش کیف پول (سمت مشتری)', () => {
  it('انواع شناخته‌شده برچسب فارسی دارند', () => {
    expect(walletTxKindLabel('admin_charge')).toBe('شارژ توسط ادمین')
    expect(walletTxKindLabel('online_charge')).toBe('شارژ آنلاین')
    expect(walletTxKindLabel('refund')).toBe('بازگشت وجه')
    expect(walletTxKindLabel('spend')).toBe('پرداخت سفارش')
    expect(walletTxKindLabel('adjust')).toBe('اصلاح حساب')
  })

  it('نوع ناشناخته بدون تغییر برمی‌گردد', () => {
    expect(walletTxKindLabel('mystery')).toBe('mystery')
    expect(walletTxKindLabel('')).toBe('')
  })

  it('وضعیت‌ها برچسب دارند و null/خالی تسویه‌شده معنا می‌دهد', () => {
    expect(walletTxStatusLabel('settled')).toBe('تسویه شده')
    expect(walletTxStatusLabel('pending')).toBe('در انتظار')
    expect(walletTxStatusLabel('failed')).toBe('ناموفق')
    expect(walletTxStatusLabel(null)).toBe('تسویه شده')
    expect(walletTxStatusLabel(undefined)).toBe('تسویه شده')
    expect(walletTxStatusLabel('weird')).toBe('weird')
  })

  it('آیکون هر نوع مشخص است', () => {
    expect(walletTxKindIcon('refund')).toBe('↩️')
    expect(walletTxKindIcon('spend')).toBe('🧾')
    expect(walletTxKindIcon('adjust')).toBe('⚖️')
    expect(walletTxKindIcon('admin_charge')).toBe('💰')
    expect(walletTxKindIcon('online_charge')).toBe('💰')
    expect(walletTxKindIcon('ناشناخته')).toBe('💰')
  })
})
