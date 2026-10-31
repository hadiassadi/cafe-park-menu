// قاعدهٔ نمایش سفارش برای مدیر
// - پرداخت در محل/کارت‌خوان یا بدون روش پرداخت: همیشه نمایش داده می‌شود
// - پرداخت‌شده یا بخشی‌پرداخت‌شده: نمایش داده می‌شود
// - در انتظار تأیید: فقط وقتی رسید (تصویر یا متن) ارسال شده باشد
export function isOrderVisibleToAdmin(o: {
  payment_method?: string | null
  payment_status?: string | null
  payment_receipt_url?: string | null
  payment_note?: string | null
}): boolean {
  const method = o.payment_method
  if (!method || method === 'cash' || method === 'card') return true
  if (o.payment_status === 'paid' || o.payment_status === 'partial') return true
  if (
    o.payment_status === 'pending_review' &&
    (o.payment_receipt_url || o.payment_note)
  ) {
    return true
  }
  return false
}
