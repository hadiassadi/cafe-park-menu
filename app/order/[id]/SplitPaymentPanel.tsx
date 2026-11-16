'use client'

import { useMemo, useState } from 'react'
import UploadReceipt from './UploadReceipt'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۰-هـ-ن — پنل «پرداخت ترکیبی»
// مشتری مبلغ باقی‌مانده را بین روش‌ها تقسیم می‌کند (تیک + مبلغ دلخواه) یا کل
// مبلغ را با یک روش می‌پردازد. همه‌جا از یک جا: سفارشِ باز و بدهی.
// اجرا: نقدی (اعلام) → کیف پول → درگاه (انتقال آخر، چون صفحه را ترک می‌کند)
// کارت‌به‌کارت مستقل است: رسید همان ردیف ارسال و تأیید مدیر می‌شود.
// ─────────────────────────────────────────────

type MethodKey = 'wallet' | 'online' | 'transfer' | 'cash'

type SplitSettings = {
  online: boolean
  transfer: boolean
  cash: boolean
}

type Props = {
  orderId: string
  remaining: number
  settings: SplitSettings
  walletBalance: number | null
  onDone: () => void
  onBack?: () => void
}

const MIN_PART = 1_000 // حداقل مبلغ هر بخش (تومان)

const fa = (n: number) => n.toLocaleString('fa-IR')

const METHOD_META: Record<MethodKey, { icon: string; label: string; hint: string }> = {
  wallet: { icon: '👛', label: 'کیف پول', hint: 'پرداخت فوری از موجودی' },
  online: { icon: '💳', label: 'درگاه آنلاین', hint: 'زرین‌پال — پرداخت فوری' },
  transfer: { icon: '🏦', label: 'کارت‌به‌کارت', hint: 'واریز + رسید؛ تأیید توسط کافه' },
  cash: { icon: '💵', label: 'نقدی در محل', hint: 'هنگام تحویل/مراجعه، نقدی یا کارت‌خوان' },
}

function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

const STEP_LABEL: Record<string, string> = {
  cash: '💵 بخش نقدی اعلام شد (پرداخت در محل)',
  wallet: '👛 بخش کیف پول پرداخت شد',
  transfer: '🏦 رسید کارت‌به‌کارت ارسال شد — در انتظار تأیید مدیر',
  online: '💳 بخش درگاه ثبت شد — در حال انتقال به درگاه…',
}

export default function SplitPaymentPanel({
  orderId,
  remaining,
  settings,
  walletBalance,
  onDone,
  onBack,
}: Props) {
  const [amounts, setAmounts] = useState<Record<MethodKey, number | null>>({
    wallet: null,
    online: null,
    transfer: null,
    cash: null,
  })
  const [raws, setRaws] = useState<Record<MethodKey, string>>({
    wallet: '',
    online: '',
    transfer: '',
    cash: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneSteps, setDoneSteps] = useState<string[]>([])
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null)
  const [receiptSent, setReceiptSent] = useState(false)

  const walletOk = walletBalance != null && walletBalance > 0

  const visibleRows = useMemo<MethodKey[]>(() => {
    const rows: MethodKey[] = []
    if (walletOk) rows.push('wallet')
    if (settings.online) rows.push('online')
    if (settings.transfer) rows.push('transfer')
    if (settings.cash) rows.push('cash')
    return rows
  }, [walletOk, settings.online, settings.transfer, settings.cash])

  const allocated = (Object.keys(amounts) as MethodKey[]).reduce(
    (s, m) => s + (amounts[m] ?? 0),
    0
  )

  // 🎯 پچ ۵۰-هـ-م: ردیفی که «کل مبلغ» را گرفته — بقیهٔ ردیف‌ها (ورودی و دکمه‌ها)
  // قفل می‌شوند تا مثل پنل ادمین، تخصیصِ دوگانه/بیش‌ازحد واضح و کنترل‌شده باشد
  const fullRow =
    visibleRows.find((m) => (amounts[m] ?? 0) === remaining) ?? null

  function setAmount(key: MethodKey, raw: string) {
    const digits = toEnDigits(raw).replace(/[^\d]/g, '')
    setRaws((r) => ({ ...r, [key]: digits }))
    const n = parseInt(digits, 10)
    let capped: number | null = Number.isFinite(n) && n > 0 ? n : null
    if (capped !== null) {
      if (capped > remaining) capped = remaining
      if (key === 'wallet' && walletBalance != null && capped > walletBalance) {
        capped = walletBalance
      }
    }
    setAmounts((a) => ({ ...a, [key]: capped }))
    setError(null)
  }

  function assignAll(key: MethodKey) {
    // «کل مبلغ با همین روش»: این ردیف = کل باقی‌مانده، بقیه خالی
    let v = remaining
    if (key === 'wallet' && walletBalance != null && v > walletBalance) v = walletBalance
    if (v < MIN_PART) return
    setAmounts({ wallet: null, online: null, transfer: null, cash: null, [key]: v })
    setRaws({ wallet: '', online: '', transfer: '', cash: '', [key]: String(v) })
    setError(null)
  }

  function clearRow(key: MethodKey) {
    setAmounts((a) => ({ ...a, [key]: null }))
    setRaws((r) => ({ ...r, [key]: '' }))
    setError(null)
  }

  // 🎯 پچ ۵۰-هـ-م: «باقی» مثل پنل ادمین — پر کردن مبلغِ هنوز تخصیص‌نیافته
  function fillRest(key: MethodKey) {
    const rest = remaining - (allocated - (amounts[key] ?? 0))
    if (rest < MIN_PART) return
    let v = rest
    if (key === 'wallet' && walletBalance != null && v > walletBalance) v = walletBalance
    if (v < MIN_PART) return
    setAmount(key, String(v))
  }

  async function postJson(url: string, payload: Record<string, unknown>) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || 'خطا در ارتباط با سرور')
    return data
  }

  async function handleSubmit() {
    setError(null)

    if (remaining <= 0) return
    const parts = visibleRows.filter((m) => (amounts[m] ?? 0) >= MIN_PART)
    if (parts.length === 0) {
      setError(`مبلغ هر بخش باید حداقل ${fa(MIN_PART)} تومان باشد.`)
      return
    }
    if (allocated > remaining) {
      setError('مجموع بخش‌ها بیشتر از باقی‌مانده است.')
      return
    }

    // کارت‌به‌کارت داخل خود ردیف ارسال می‌شود؛ اینجا فقط wallet/cash/online
    const payable = parts.filter((m) => m !== 'transfer')
    if (payable.length === 0) {
      setError('مبلغ کارت‌به‌کارت را وارد کن و رسید را در همان ردیف بفرست.')
      return
    }
    if (parts.includes('transfer') && !receiptSent) {
      setError('برای بخش کارت‌به‌کارت، رسید را در همان ردیف ارسال کن (یا مبلغش را خالی بگذار).')
      return
    }

    setBusy(true)
    try {
      // ۱) اعلام نقدی در محل (فقط یادداشت — تسویهٔ واقعی با اپراتور)
      if ((amounts.cash ?? 0) >= MIN_PART) {
        await postJson('/api/payment/cash-note', { orderId, amount: amounts.cash })
        setDoneSteps((d) => [...d, 'cash'])
      }

      // ۲) کیف پول — فوری
      if ((amounts.wallet ?? 0) >= MIN_PART) {
        await postJson('/api/payment/wallet', { orderId, amount: amounts.wallet })
        setDoneSteps((d) => [...d, 'wallet'])
      }

      // ۳) درگاه — آخرین مرحله چون صفحه را ترک می‌کند
      if ((amounts.online ?? 0) >= MIN_PART) {
        const data = await postJson('/api/payment/request', {
          orderId,
          amount: amounts.online,
        })
        setDoneSteps((d) => [...d, 'online'])
        setGatewayUrl(data.paymentUrl ?? null)
        onDone()
        if (data.paymentUrl) {
          setTimeout(() => window.location.assign(data.paymentUrl), 900)
        }
        return
      }

      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در پرداخت')
    } finally {
      setBusy(false)
    }
  }

  const overLimit = allocated > remaining
  const leftover = Math.max(0, remaining - allocated)

  return (
    <div className="order-payment-section" style={{ marginTop: '12px' }}>
      <div className="order-payment-section-title">🧩 پرداخت ترکیبی</div>
      <p className="order-payment-section-desc">
        مبلغ باقی‌مانده ({fa(remaining)} تومان) را بین روش‌ها تقسیم کن، یا با دکمهٔ
        «کل مبلغ» همه را با یک روش پرداخت کن. باقی‌ماندهٔ پرداخت‌نشده به‌عنوان بدهی
        روی سفارش می‌ماند.
      </p>

      {doneSteps.length > 0 && (
        <div className="admin-message" style={{ marginBottom: '12px' }}>
          {doneSteps.map((s) => (
            <div key={s} style={{ marginTop: '4px' }}>✅ {STEP_LABEL[s]}</div>
          ))}
        </div>
      )}

      {error && (
        <div className="checkout-error" style={{ marginBottom: '12px' }}>❌ {error}</div>
      )}

      {visibleRows.map((m) => {
        const meta = METHOD_META[m]
        const val = amounts[m] ?? 0
        const capHint =
          m === 'wallet' && walletBalance != null
            ? `موجودی: ${fa(walletBalance)} تومان`
            : meta.hint
        // 🎯 پچ ۵۰-هـ-م: ردیف‌های غیر از «کل مبلغ» قفل می‌شوند
        const isLockedRow = fullRow !== null && fullRow !== m
        const restForMe = Math.max(0, remaining - (allocated - val))
        return (
          <div
            key={m}
            style={{
              border: '1px solid #e5e0d8',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '10px',
              background: val >= MIN_PART ? '#faf7f2' : '#fff',
              opacity: isLockedRow ? 0.55 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '14px' }}>
                  {meta.label}
                  {isLockedRow ? ' 🔒' : ''}
                </strong>
                <div style={{ fontSize: '11px', color: '#8a8378' }}>
                  {isLockedRow
                    ? 'یک ردیف «کل مبلغ» دارد — برای آزادسازی ✕ همان ردیف یا کم کردن مبلغش'
                    : capHint}
                </div>
              </div>
              <button
                type="button"
                className="order-payment-btn secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => assignAll(m)}
                disabled={busy || isLockedRow}
                title="کل باقی‌مانده با همین روش — بقیهٔ ردیف‌ها قفل می‌شوند"
              >
                کل مبلغ
              </button>
              <button
                type="button"
                className="order-payment-btn secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => fillRest(m)}
                disabled={busy || isLockedRow || restForMe < MIN_PART}
                title="پر کردن مبلغِ هنوز تخصیص‌نیافته"
              >
                باقی
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                inputMode="numeric"
                value={raws[m]}
                onChange={(e) => setAmount(m, e.target.value)}
                placeholder={`مبلغ (تومان) — حداکثر ${fa(m === 'wallet' && walletBalance != null ? Math.min(walletBalance, remaining) : remaining)}`}
                disabled={busy || isLockedRow}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #ddd6ca',
                  fontSize: '13px',
                  textAlign: 'left',
                  direction: 'ltr',
                }}
              />
              {val > 0 && (
                <button
                  type="button"
                  onClick={() => clearRow(m)}
                  disabled={busy || isLockedRow}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                  aria-label="پاک کردن"
                >
                  ✕
                </button>
              )}
            </div>

            {m === 'cash' && val >= MIN_PART && (
              <div style={{ fontSize: '12px', color: '#8a5a00', marginTop: '6px' }}>
                این بخش هنگام تحویل/مراجعه نقدی پرداخت می‌شود و پس از دریافت، کافه تأیید می‌کند.
              </div>
            )}

            {m === 'transfer' && val >= MIN_PART && !receiptSent && (
              <div style={{ marginTop: '10px' }}>
                <p className="order-payment-section-desc" style={{ marginBottom: '6px' }}>
                  🏦 مبلغ {fa(val)} تومان را واریز کن و رسید را بفرست:
                </p>
                <UploadReceipt
                  orderId={orderId}
                  amount={val}
                  onSuccess={() => {
                    setReceiptSent(true)
                    setDoneSteps((d) => [...d, 'transfer'])
                    onDone()
                  }}
                />
              </div>
            )}
          </div>
        )
      })}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderRadius: '10px',
          background: overLimit ? '#fdecec' : '#f4f1ea',
          fontSize: '13px',
          fontWeight: 'bold',
        }}
      >
        <span>مجموع تخصیص‌یافته: {fa(allocated)} تومان</span>
        <span style={{ color: overLimit ? '#c0392b' : '#6b6459' }}>
          {overLimit
            ? 'بیشتر از باقی‌مانده!'
            : leftover > 0
              ? `باقی‌ماندهٔ بدون تخصیص: ${fa(leftover)} تومان`
              : 'کل مبلغ پوشش داده شد ✓'}
        </span>
      </div>

      {gatewayUrl ? (
        <div className="admin-message" style={{ marginTop: '12px', textAlign: 'center' }}>
          ⏳ در حال انتقال به درگاه پرداخت…
        </div>
      ) : (
        <>
          <button
            type="button"
            className="order-payment-btn primary"
            style={{ marginTop: '12px', width: '100%' }}
            onClick={handleSubmit}
            disabled={busy || remaining <= 0}
          >
            {busy ? '...' : '🧩 ثبت و پرداخت ترکیبی'}
          </button>
          {onBack && (
            <button
              type="button"
              className="order-payment-btn secondary"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={onBack}
              disabled={busy}
            >
              ← بازگشت به روش‌های تکی
            </button>
          )}
        </>
      )}
    </div>
  )
}
