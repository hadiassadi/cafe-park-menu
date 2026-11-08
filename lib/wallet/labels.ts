// lib/wallet/labels.ts

/**
 * برچسب‌های فارسی تراکنش‌های کیف پول — نسخه‌ی client-safe.
 * عمداً بدون import 'server-only' تا کامپوننت‌های مشتری (my-orders) هم بتوانند استفاده کنند.
 * نسخه‌ی سرویس‌ساید معادل در lib/wallet/wallet.ts (WALLET_KIND_LABELS) نگهداری می‌شود؛
 * برچسب‌های مشترک باید هم‌قد بمانند.
 */

export const WALLET_CLIENT_KIND_LABELS: Record<string, string> = {
  admin_charge: 'شارژ توسط ادمین',
  online_charge: 'شارژ آنلاین',
  refund: 'بازگشت وجه',
  spend: 'پرداخت سفارش',
  adjust: 'اصلاح حساب',
}

export function walletTxKindLabel(kind: string): string {
  return WALLET_CLIENT_KIND_LABELS[kind] ?? kind
}

export const WALLET_STATUS_LABELS: Record<string, string> = {
  settled: 'تسویه شده',
  pending: 'در انتظار',
  failed: 'ناموفق',
}

/** ردیف‌های قدیمی status=null دارند — همان تسویه‌شده معنا می‌دهند */
export function walletTxStatusLabel(status: string | null | undefined): string {
  if (!status) return WALLET_STATUS_LABELS.settled
  return WALLET_STATUS_LABELS[status] ?? status
}

export function walletTxKindIcon(kind: string): string {
  if (kind === 'refund') return '↩️'
  if (kind === 'spend') return '🧾'
  if (kind === 'adjust') return '⚖️'
  return '💰' // admin_charge / online_charge
}
