// قواعد خالص دسترسی به کیف پول — بدون وابستگی به DB، قابل تست با vitest.
// سرور و کلاینت هر دو همین قواعد را می‌خوانند تا وضعیت پنل با واقعیت API یکی باشد.

export type VerificationStatus = 'unverified' | 'pending' | 'verified'

export type WalletAccessInput = {
  /** سوییچ سراسری «کیف پول» در تنظیمات پرداخت */
  walletEnabled: boolean
  /** وضعیت احراز هویت مشتری (لینک دعوت / تأیید حضوری ادمین / OTP) */
  verification: VerificationStatus
  /** مسدودسازی این مشتری توسط ادمین */
  walletBlocked: boolean
}

export type WalletAccess =
  | 'active' // همه‌چیز آماده — موجودی و خرج آزاد است
  | 'unverified' // هنوز احراز هویت نشده
  | 'blocked' // توسط ادمین مسدود شده
  | 'disabled' // کیف پول در تنظیمات خاموش است

export function walletAccessState(i: WalletAccessInput): WalletAccess {
  if (!i.walletEnabled) return 'disabled'
  if (i.walletBlocked) return 'blocked'
  if (i.verification === 'verified') return 'active'
  return 'unverified'
}

/** آیا این مشتری حق «خرج کردن» از کیف پول دارد؟ (مسیر POST پرداخت) */
export function canSpendFromWallet(i: WalletAccessInput): boolean {
  return walletAccessState(i) === 'active'
}

/** آیا دکمه «احراز هویت با کد پیامکی» باید فعال باشد؟ — فقط با تنظیمات پیامک */
export function otpButtonEnabled(smsConfigured: boolean): boolean {
  return smsConfigured
}
