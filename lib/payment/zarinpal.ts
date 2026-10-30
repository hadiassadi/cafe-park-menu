// lib/payment/zarinpal.ts

export type ZarinPalConfig = {
  merchantId: string
  sandbox: boolean
}

export type ZarinPalRequestResult =
  | { success: true; authority: string; paymentUrl: string }
  | { success: false; error: string }

export type ZarinPalVerifyResult =
  | { success: true; refId: string; cardPan?: string }
  | { success: false; error: string; retryable: boolean }

const TIMEOUT_MS = 10_000

const PROD_REQUEST = 'https://api.zarinpal.com/pg/v4/payment/request.json'
const PROD_VERIFY = 'https://api.zarinpal.com/pg/v4/payment/verify.json'
const PROD_STARTPAY = 'https://www.zarinpal.com/pg/StartPay'

const SANDBOX_REQUEST =
  'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
const SANDBOX_VERIFY =
  'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
const SANDBOX_STARTPAY = 'https://sandbox.zarinpal.com/pg/StartPay'

/**
 * شروع پرداخت با زرین‌پال
 * @param amountToman مبلغ به تومان
 */
export async function requestZarinPalPayment(
  config: ZarinPalConfig,
  amountToman: number,
  callbackUrl: string,
  description: string,
  mobile?: string
): Promise<ZarinPalRequestResult> {
  try {
    const url = config.sandbox ? SANDBOX_REQUEST : PROD_REQUEST
    const amountRial = Math.round(amountToman * 10)

    if (amountRial < 1000) {
      return { success: false, error: 'مبلغ پرداخت باید حداقل ۱۰۰ تومان باشد' }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        amount: amountRial,
        callback_url: callbackUrl,
        description,
        metadata: mobile ? { mobile } : undefined,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const data = await res.json()

    if (data?.data?.code === 100 && data.data.authority) {
      const startpay = config.sandbox ? SANDBOX_STARTPAY : PROD_STARTPAY
      return {
        success: true,
        authority: data.data.authority,
        paymentUrl: `${startpay}/${data.data.authority}`,
      }
    }

    console.error('[zarinpal/request] rejected:', data?.errors)
    return { success: false, error: 'خطا در ایجاد تراکنش زرین‌پال' }
  } catch (err) {
    console.error('[zarinpal/request]', err)
    return { success: false, error: 'ارتباط با درگاه برقرار نشد' }
  }
}

/**
 * تأیید پرداخت زرین‌پال
 * @param amountToman مبلغ به تومان (باید با مبلغ request یکسان باشد)
 */
export async function verifyZarinPalPayment(
  config: ZarinPalConfig,
  authority: string,
  amountToman: number
): Promise<ZarinPalVerifyResult> {
  try {
    const url = config.sandbox ? SANDBOX_VERIFY : PROD_VERIFY
    const amountRial = Math.round(amountToman * 10)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        amount: amountRial,
        authority,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const data = await res.json()

    // 100 = تأیید موفق، 101 = قبلاً تأیید شده
    if (data?.data?.code === 100 || data?.data?.code === 101) {
      return {
        success: true,
        refId: String(data.data.ref_id),
        cardPan: data.data.card_pan,
      }
    }

    // رد قطعی از طرف درگاه
    if (data?.errors && !Array.isArray(data.errors)) {
      console.error('[zarinpal/verify] rejected:', data.errors)
      return { success: false, error: 'rejected', retryable: false }
    }

    // پاسخ نامشخص: سفارش را failed نکنید
    console.error('[zarinpal/verify] unknown response:', data)
    return { success: false, error: 'unknown', retryable: true }
  } catch (err) {
    // timeout یا خطای شبکه: وضعیت پرداخت معلوم نیست
    console.error('[zarinpal/verify] network:', err)
    return { success: false, error: 'network', retryable: true }
  }
}
