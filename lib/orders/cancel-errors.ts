const MAP: Record<string, { status: number; text: string }> = {
  order_not_found: { status: 404, text: 'سفارش پیدا نشد' },
  already_cancelled: { status: 409, text: 'این سفارش قبلاً لغو شده است' },
  order_delivered: { status: 400, text: 'سفارش تحویل‌شده قابل لغو نیست' },
  pending_receipts: {
    status: 400,
    text: 'رسید در انتظار بررسی دارد؛ ابتدا رسید را تأیید یا رد کنید',
  },
  not_cancellable: { status: 400, text: 'این سفارش دیگر قابل لغو نیست' },
  paid_or_receipt: {
    status: 400,
    text: 'سفارش پرداخت‌شده یا دارای رسید را فقط کافه می‌تواند لغو کند',
  },
  window_expired: { status: 400, text: 'زمان مجاز برای لغو به پایان رسیده است' },
  refund_method_required: {
    status: 400,
    text: 'این سفارش پرداخت تأییدشده دارد؛ روش بازپرداخت را انتخاب کنید',
  },
  wallet_not_allowed: {
    status: 400,
    text: 'مشتری تلفن تأییدشده ندارد؛ فقط بازگشت نقدی ممکن است',
  },
    wallet_disabled: {
    status: 400,
    text: 'بازپرداخت به کیف پول هنوز فعال نیست؛ روش نقدی یا دستی درگاه را انتخاب کنید',
  },
  wallet_customer_not_found: {
    status: 400,
    text: 'مشتریِ این سفارش کیف پول ندارد؛ بازگشت نقدی را انتخاب کنید',
  },

}

export function cancelErrorInfo(message: string | undefined) {
  const key = Object.keys(MAP).find((k) => message?.includes(k))
  return key ? { code: key, ...MAP[key] } : null
}
