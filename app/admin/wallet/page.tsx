'use client'

import { useState } from 'react'
import { formatPersianDate } from '@/lib/format-date'

type WalletTx = {
  id: string
  amount: number
  kind: string
  status: string
  note: string | null
  created_at: string
}

type WalletView = {
  balance: number
  transactions: WalletTx[]
}

const KIND_LABELS: Record<string, string> = {
  admin_charge: 'شارژ توسط ادمین',
  online_charge: 'شارژ آنلاین',
  refund: 'بازگشت وجه',
  spend: 'خرج سفارش',
}

const fmt = (n: number) => n.toLocaleString('fa-IR')

export default function WalletPage() {
  const [phone, setPhone] = useState('')
  const [view, setView] = useState<WalletView | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [charging, setCharging] = useState(false)

  async function load(e?: React.FormEvent) {
    e?.preventDefault()
    setMsg(null)
    setView(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/wallet?phone=${encodeURIComponent(phone)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error || 'خواندن ناموفق بود' })
        return
      }
      setView(json)
    } catch {
      setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
    } finally {
      setLoading(false)
    }
  }

  async function charge(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setCharging(true)
    try {
      const res = await fetch('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, amount: Number(amount.replace(/[^\d]/g, '')), note }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error || 'شارژ ناموفق بود' })
        return
      }
      setMsg({ kind: 'ok', text: `کیف پول ${fmt(Number(amount.replace(/[^\d]/g, '')))} تومانی شارژ شد ✓` })
      setAmount('')
      setNote('')
      await load()
    } catch {
      setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
    } finally {
      setCharging(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>👛 کیف پول مشتریان</h1>
      <p style={{ opacity: 0.7, fontSize: 13, lineHeight: 2 }}>
        جست‌وجو با شماره موبایل؛ شارژ دستی فقط برای مشتری‌هایی که سابقه دارند (حداقل یک‌بار سفارش یا ورود با OTP).
      </p>

      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            margin: '12px 0',
            background: msg.kind === 'ok' ? '#e6f6ea' : '#fdeaea',
            color: msg.kind === 'ok' ? '#176a32' : '#8f2020',
            fontSize: 14,
          }}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={load} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={loading || !phone}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: loading || !phone ? '#999' : '#6f4e37',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: loading || !phone ? 'default' : 'pointer',
          }}
        >
          {loading ? '…' : 'جست‌وجو'}
        </button>
      </form>

      {view && (
        <>
          <div
            style={{
              marginTop: 16,
              padding: '14px 18px',
              borderRadius: 10,
              background: '#f7f2ec',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: 14 }}>موجودی فعلی</strong>
            <strong style={{ fontSize: 22 }}>
              {fmt(view.balance)} <span style={{ fontSize: 12 }}>تومان</span>
            </strong>
          </div>

          <form onSubmit={charge} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <strong style={{ fontSize: 14 }}>شارژ دستی</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثلاً 200000"
                inputMode="numeric"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={charging || !amount}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: charging || !amount ? '#999' : '#2e7d32',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: charging || !amount ? 'default' : 'pointer',
                }}
              >
                {charging ? '…' : 'شارژ'}
              </button>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="یادداشت (اختیاری) — مثلاً «فروشنده، نقدی»"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}
            />
          </form>

          <h2 style={{ fontSize: 15, margin: '24px 0 8px' }}>تراکنش‌های اخیر</h2>
          {view.transactions.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: 13 }}>تراکنشی ثبت نشده است.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {view.transactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #e5e0da',
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{KIND_LABELS[tx.kind] ?? tx.kind}</div>
                    <div style={{ opacity: 0.65, fontSize: 12 }}>
                      {formatPersianDate(tx.created_at)}
                      {tx.note ? ` — ${tx.note}` : ''}
                    </div>
                  </div>
                  <strong style={{ color: tx.amount >= 0 ? '#176a32' : '#8f2020', fontSize: 15 }}>
                    {tx.amount >= 0 ? '+' : '−'}{fmt(Math.abs(tx.amount))}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
