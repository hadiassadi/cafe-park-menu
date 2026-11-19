'use client'

import { useEffect, useMemo, useState } from 'react'
import UploadReceipt from './UploadReceipt'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۰-هـ-ن — پنل «پرداخت ترکیبی» مشتری با همان فرمت پنل ادمین:
// چیپ‌های فشردهٔ تیک‌دار روش‌ها + باکس مبلغ + «کل مبلغ»/«باقی».
// «کل مبلغ» روی یک روش، بقیه را قفل می‌کند (🔒) — مثل AdminSplitPayment.
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

const METHODS: Array<{ key: MethodKey; icon: string; label: string }> = [
  { key: 'wallet', icon: '👛', label: 'کیف پول' },
  { key: 'online', icon: '💳', label: 'درگاه آنلاین' },
  { key: 'transfer', icon: '🏦', label: 'کارت‌به‌کارت' },
  { key: 'cash', icon: '💵', label: 'نقدی در محل' },
]

const METHOD_HINT: Record<MethodKey, string> = {
  wallet: 'پرداخت فوری از موجودی',
  online: 'زرین‌پال — پرداخت فوری',
  transfer: 'واریز + رسید؛ تأیید توسط کافه',
  cash: 'هنگام تحویل/مراجعه، نقدی یا کارت‌خوان',
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

/* 🎯 پچ ۵۰-هـ-ن: استایل مشترک با پنل ادمین (AdminSplitPayment) */
const chipBase: React.CSSProperties = {
  fontSize: 12.5,
  padding: '5px 12px',
  borderRadius: 999,
  border: '1px solid #e3ddd2',
  background: '#fff',
  color: '#4b443b',
  cursor: 'pointer',
  font: 'inherit',
  whiteSpace: 'nowrap',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
  fontSize: 13,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e3ddd2',
  font: 'inherit',
  color: '#4b443b',
  background: '#fff',
  direction: 'ltr',
  textAlign: 'left',
}

const miniBtn: React.CSSProperties = {
  fontSize: 11.5,
  padding: '4px 9px',
  borderRadius: 8,
  border: '1px solid #e3ddd2',
  background: '#fff',
  color: '#4b443b',
  cursor: 'pointer',
  font: 'inherit',
  whiteSpace: 'nowrap',
}

export default function SplitPaymentPanel({
  orderId,
  remaining,
  settings,
  walletBalance,
  onDone,
  onBack,
}: Props) {
  const walletOk = walletBalance != null && walletBalance > 0

  const visibleRows = useMemo<MethodKey[]>(() => {
    const rows: MethodKey[] = []
    if (walletOk) rows.push('wallet')
    if (settings.online) rows.push('online')
    if (settings.transfer) rows.push('transfer')
    if (settings.cash) rows.push('cash')
    return rows
  }, [walletOk, settings.online, settings.transfer, settings.cash])

  // پیش‌فرض: همهٔ روش‌های موجود تیک‌خورده‌اند (null = هنوز دستکاری نشده)
  const [selected, setSelected] = useState<MethodKey[] | null>(null)
  const sel = selected ?? visibleRows
  const [amounts, setAmounts] = useState<Partial<Record<MethodKey, number>>>({})
  const [raws, setRaws] = useState<Partial<Record<MethodKey, string>>>({})
  const [locked, setLocked] = useState<MethodKey | null>(null) // «کل مبلغ»
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneSteps, setDoneSteps] = useState<string[]>([])
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null)
  const [receiptSent, setReceiptSent] = useState(false)
  // 🎯 پچ ۵۰-هـ-س: دکمهٔ «نهایی کردن سفارش» — بررسی تسویه و پیام متناسب
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeMsg, setFinalizeMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  // 🎯 پچ ۵۰-هـ-ش: تغییر مبلغ بخش نقدی بعد از اعلام → اعلام قبلی باطل می‌شود
  // (مبلغ جدید موقع ثبت/نهایی‌کردن دوباره اعلام می‌شود)
  useEffect(() => {
    setDoneSteps((d) => (d.includes('cash') ? d.filter((x) => x !== 'cash') : d))
  }, [amounts.cash])

  const allocated = sel.reduce((s, k) => s + (amounts[k] ?? 0), 0)
  const overLimit = allocated > remaining

  function toggleMethod(key: MethodKey) {
    if (busy) return
    setError(null)
    if (sel.includes(key)) {
      if (locked === key) setLocked(null)
      setAmounts((a) => {
        const n = { ...a }
        delete n[key]
        return n
      })
      setRaws((r) => {
        const n = { ...r }
        delete n[key]
        return n
      })
      setSelected((s) => (s ?? visibleRows).filter((k) => k !== key))
    } else {
      setSelected((s) => [...(s ?? visibleRows), key])
    }
  }

  function capFor(key: MethodKey, v: number): number {
    let out = Math.min(v, remaining)
    if (key === 'wallet' && walletBalance != null) out = Math.min(out, walletBalance)
    return out
  }

  function setAmount(key: MethodKey, raw: string) {
    const digits = toEnDigits(raw).replace(/[^\d]/g, '')
    setRaws((r) => ({ ...r, [key]: digits }))
    const n = parseInt(digits, 10)
    const v = Number.isFinite(n) && n > 0 ? capFor(key, n) : undefined
    setAmounts((a) => ({ ...a, [key]: v }))
    setError(null)
    // مبلغِ ردیفِ قفل‌شده دستی از «کل» کمتر شد → قفل بی‌معناست و باز می‌شود
    if (locked === key && (v ?? 0) < remaining) setLocked(null)
  }

  /** «کل مبلغ» با این روش: مبلغ کامل می‌شود و بقیهٔ روش‌ها قفل می‌شوند */
  function assignAll(key: MethodKey) {
    if (remaining < MIN_PART) return
    setError(null)
    setLocked(key)
    setSelected(visibleRows.filter((k) => k === key))
    const v = capFor(key, remaining)
    setAmounts({ [key]: v })
    setRaws({ [key]: String(v) })
  }

  /** «باقی» — پر کردن مبلغِ هنوز تخصیص‌نیافته در این ردیف */
  function fillRest(key: MethodKey) {
    const rest = remaining - (allocated - (amounts[key] ?? 0))
    if (rest < MIN_PART) return
    const v = capFor(key, rest)
    if (v < MIN_PART) return
    setAmount(key, String(v))
  }

  function clearRow(key: MethodKey) {
    if (locked === key) setLocked(null)
    setAmounts((a) => {
      const n = { ...a }
      delete n[key]
      return n
    })
    setRaws((r) => {
      const n = { ...r }
      delete n[key]
      return n
    })
    setError(null)
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

  /**
   * 🎯 پچ ۵۰-هـ-ش: اعتبارسنجی و اجرای بخش‌های اعلام‌شده (اعلام نقدی، کیف پول،
   * درگاه) — بدون بررسی نهایی. اگر بخش درگاه باشد صفحه به زرین‌پال منتقل می‌شود
   * و 'redirected' برمی‌گردد. گام‌های قبلاً انجام‌شده (doneSteps) تکرار نمی‌شوند.
   */
  async function processParts(): Promise<'redirected' | 'done' | 'invalid'> {
    setError(null)

    if (remaining <= 0) return 'invalid'
    const parts = sel.filter((m) => (amounts[m] ?? 0) >= MIN_PART)
    if (parts.length === 0) {
      setError(`مبلغ هر بخش باید حداقل ${fa(MIN_PART)} تومان باشد.`)
      return 'invalid'
    }
    if (allocated > remaining) {
      setError('مجموع بخش‌ها بیشتر از باقی‌مانده است.')
      return 'invalid'
    }

    // کارت‌به‌کارت داخل خود ردیف ارسال می‌شود؛ اینجا فقط wallet/cash/online
    const payable = parts.filter((m) => m !== 'transfer')
    if (payable.length === 0 && !receiptSent) {
      setError('مبلغ کارت‌به‌کارت را وارد کن و رسید را در همان ردیف بفرست.')
      return 'invalid'
    }
    if (parts.includes('transfer') && !receiptSent) {
      setError('برای بخش کارت‌به‌کارت، رسید را در همان ردیف ارسال کن (یا مبلغش را خالی بگذار).')
      return 'invalid'
    }

    try {
      // ۱) اعلام نقدی در محل (فقط یادداشت — تسویهٔ واقعی با اپراتور)
      const cashAmt = amounts.cash ?? 0
      if (cashAmt >= MIN_PART && !doneSteps.includes('cash')) {
        await postJson('/api/payment/cash-note', { orderId, amount: cashAmt })
        setDoneSteps((d) => (d.includes('cash') ? d : [...d, 'cash']))
      }

      // ۲) کیف پول — فوری
      const walletAmt = amounts.wallet ?? 0
      if (walletAmt >= MIN_PART && !doneSteps.includes('wallet')) {
        await postJson('/api/payment/wallet', { orderId, amount: walletAmt })
        setDoneSteps((d) => (d.includes('wallet') ? d : [...d, 'wallet']))
      }

      // ۳) درگاه — آخرین مرحله چون صفحه را ترک می‌کند
      const onlineAmt = amounts.online ?? 0
      if (onlineAmt >= MIN_PART && !doneSteps.includes('online')) {
        const data = await postJson('/api/payment/request', {
          orderId,
          amount: onlineAmt,
        })
        setDoneSteps((d) => (d.includes('online') ? d : [...d, 'online']))
        setGatewayUrl(data.paymentUrl ?? null)
        onDone()
        if (data.paymentUrl) {
          setTimeout(() => window.location.assign(data.paymentUrl), 900)
        }
        return 'redirected'
      }

      return 'done'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در پرداخت')
      return 'invalid'
    }
  }

  /**
   * 🎯 پچ ۵۰-هـ-ش: بررسی تسویه و نهایی‌سازی — سرور چک می‌کند فاکتور کامل
   * تسویه شده یا باقی‌مانده با «پرداخت در محل» پوشش داده شده؛ پیام متناسب
   * نمایش داده می‌شود و در صورت نهایی‌شدن، وضعیت سفارش رفرش می‌شود.
   */
  async function runFinalizeCheck() {
    try {
      const res = await fetch('/api/orders/finalize-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'بررسی نهایی‌سازی ناموفق بود')
        return
      }
      setFinalizeMsg({ ok: !!data.finalized, text: data.message || '' })
      if (data.finalized) onDone()
    } catch {
      setError('خطا در ارتباط با سرور')
    }
  }

  /**
   * 🎯 پچ ۵۰-هـ-ش: «ثبت و پرداخت ترکیبی» بعد از ثبت بخش‌ها (وقتی انتقال به
   * درگاه در کار نیست) خودش تسویه را بررسی و سفارش را نهایی می‌کند — مثلاً
   * «کل مبلغ» نقدی در محل → سفارش همین‌جا تأیید و برای مدیر ارسال می‌شود.
   */
  async function handleSubmit() {
    setBusy(true)
    try {
      const r = await processParts()
      if (r !== 'done') return
      await runFinalizeCheck()
    } finally {
      setBusy(false)
    }
  }

  /**
   * 🎯 پچ ۵۰-هـ-ش: دکمهٔ «نهایی کردن سفارش و ارسال به کافه» — اول بخش‌های
   * تیک‌خورده را اعلام/پرداخت می‌کند (بدون نیاز به زدن دکمهٔ ثبت به‌صورت جدا)،
   * بعد تسویه را بررسی و سفارش را نهایی می‌کند. بدون تخصیص، فقط بررسی می‌کند.
   */
  async function handleFinalize() {
    setFinalizeMsg(null)
    setFinalizing(true)
    try {
      const hasAlloc = sel.some((m) => (amounts[m] ?? 0) >= MIN_PART)
      const r = hasAlloc ? await processParts() : 'done'
      if (r !== 'done') return
      await runFinalizeCheck()
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <div className="order-payment-section" style={{ marginTop: '12px' }}>
      <div className="order-payment-section-title">🧩 پرداخت ترکیبی</div>
      <p className="order-payment-section-desc">
        روش‌ها را تیک بزن (چند روش = تقسیم مبلغ) و مبلغ هر بخش را وارد کن.
        دکمهٔ «کل مبلغ» همه را با یک روش می‌پردازد و بقیه را قفل می‌کند؛
        باقی‌ماندهٔ پرداخت‌نشده به‌عنوان بدهی روی سفارش می‌ماند.
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

      {/* ── چیپ‌های فشردهٔ روش‌ها — مثل پنل ادمین ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {METHODS.filter((m) => visibleRows.includes(m.key)).map((m) => {
          const isSel = sel.includes(m.key)
          const disabled = busy || (locked !== null && !isSel)
          return (
            <button
              key={m.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleMethod(m.key)}
              style={{
                ...chipBase,
                ...(isSel
                  ? { background: '#2d5d3e', borderColor: '#2d5d3e', color: '#fff' }
                  : {}),
                ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
              }}
            >
              {isSel ? '✓ ' : ''}
              {m.icon} {m.label}
              {!isSel && locked !== null ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      {/* ── باکس مبلغ فقط برای روش‌های تیک‌خورده ── */}
      {visibleRows
        .filter((m) => sel.includes(m))
        .map((m) => {
          const meta = METHODS.find((x) => x.key === m)!
          const val = amounts[m] ?? 0
          const isLockedRow = locked !== null && locked !== m
          const restForMe = Math.max(0, remaining - (allocated - val))
          const capHint =
            m === 'wallet' && walletBalance != null
              ? `موجودی: ${fa(walletBalance)} تومان`
              : METHOD_HINT[m]
          return (
            <div
              key={m}
              style={{
                border: '1px solid #e5e0d8',
                borderRadius: 10,
                padding: '8px 10px',
                marginBottom: 8,
                background: val >= MIN_PART ? '#faf7f2' : '#fff',
                opacity: isLockedRow ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 108 }}>
                  {meta.icon} {meta.label}
                  {isLockedRow ? ' 🔒' : ''}
                </span>
                <input
                  value={raws[m] ?? ''}
                  onChange={(e) => setAmount(m, e.target.value)}
                  placeholder={locked === m ? String(remaining) : 'مبلغ (تومان)'}
                  inputMode="numeric"
                  disabled={busy || isLockedRow}
                  style={inputStyle}
                />
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => assignAll(m)}
                  disabled={busy || isLockedRow}
                  title="کل باقی‌مانده با این روش — بقیهٔ روش‌ها قفل می‌شوند"
                >
                  کل مبلغ
                </button>
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => fillRest(m)}
                  disabled={busy || isLockedRow || restForMe < MIN_PART}
                  title="پر کردن مبلغِ هنوز تخصیص‌نیافته"
                >
                  باقی
                </button>
                <button
                  type="button"
                  style={{ ...miniBtn, border: 'none', background: 'none' }}
                  onClick={() => clearRow(m)}
                  disabled={busy || isLockedRow}
                  aria-label="حذف روش"
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#8a8378', marginTop: 4 }}>{capHint}</div>

              {m === 'cash' && val >= MIN_PART && (
                <div style={{ fontSize: 12, color: '#8a5a00', marginTop: 6 }}>
                  این بخش هنگام تحویل/مراجعه نقدی پرداخت می‌شود و پس از دریافت، کافه تأیید می‌کند.
                </div>
              )}

              {m === 'transfer' && val >= MIN_PART && !receiptSent && (
                <div style={{ marginTop: 10 }}>
                  <p className="order-payment-section-desc" style={{ marginBottom: 6 }}>
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

      {/* ── نوار مانده — مثل ادمین ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          fontSize: 12.5,
          fontWeight: 700,
          padding: '6px 10px',
          borderRadius: 8,
          background: overLimit ? '#fdecec' : '#f1ede4',
          color: overLimit ? '#9b3c32' : '#4b443b',
          marginBottom: 8,
        }}
      >
        <span>مجموع تخصیص‌یافته: {fa(allocated)} تومان</span>
        <span>
          {overLimit
            ? 'بیشتر از باقی‌مانده!'
            : `باقی‌ماندهٔ بدون تخصیص: ${fa(Math.max(0, remaining - allocated))} تومان`}
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

          {/* 🎯 پچ ۵۰-هـ-س: نهایی‌کردن سفارش — بررسی تسویه + پیام متناسب */}
          <button
            type="button"
            className="order-payment-btn primary"
            style={{ marginTop: '8px', width: '100%' }}
            onClick={handleFinalize}
            disabled={busy || finalizing || remaining <= 0}
          >
            {finalizing ? '...' : '✅ نهایی کردن سفارش و ارسال به کافه'}
          </button>
          <p className="order-payment-section-desc" style={{ marginTop: 6 }}>
            هر دو دکمه بخش‌های تیک‌خورده را پرداخت/اعلام می‌کنند؛ «ارسال به کافه»
            بعدش تسویه را بررسی می‌کند: اگر مبلغ کامل شده باشد (یا باقی‌مانده
            «پرداخت در محل» اعلام شده باشد) سفارش نهایی و برای کافه ارسال
            می‌شود، وگرنه پیام راهنما می‌بینی.
          </p>
          {finalizeMsg && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: finalizeMsg.ok ? '#eef7f0' : '#fdf6e3',
                color: finalizeMsg.ok ? '#2d5d3e' : '#8a5a00',
                border: `1px solid ${finalizeMsg.ok ? '#cfe4d6' : '#ead9b0'}`,
              }}
            >
              {finalizeMsg.text}
            </div>
          )}

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
