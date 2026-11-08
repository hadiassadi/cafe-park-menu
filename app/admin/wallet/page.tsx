'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
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

type Invite = {
  id: string
  token: string
  expires_at: string
  used_at: string | null
  used_phone: string | null
  used_device_info: string | null
  used_device_hash: string | null
  is_active: boolean
  created_at: string
}

type ActivationRequest = {
  id: string
  name: string | null
  phone: string | null
  status: string
  created_at: string
  customer: { verification_status: string; wallet_blocked: boolean; device_info: string | null } | null
}

type ChargeRequest = {
  id: string
  amount: number
  status: string
  receipt_url: string | null
  tracking_no: string | null
  reject_reason: string | null
  created_at: string
  customer: { phone: string | null; name: string | null; wallet_blocked: boolean; card_charge_blocked: boolean } | null
}

type WalletSettings = {
  wallet_card_charge_enabled: boolean
  wallet_charge_min: number
  wallet_charge_max: number
  payment_transfer_bank_name: string | null
  payment_transfer_card_number: string | null
  payment_transfer_account_holder: string | null
}

const KIND_LABELS: Record<string, string> = {
  admin_charge: 'شارژ توسط ادمین',
  online_charge: 'شارژ آنلاین',
  receipt_charge: 'شارژ با تأیید رسید',
  subscription_purchase: 'خرید اشتراک',
  refund: 'بازگشت وجه',
  spend: 'خرج سفارش',
  wallet_activation: 'فعال‌سازی کیف پول',
}

const fmt = (n: number) => n.toLocaleString('fa-IR')

// ارقام فارسی/عربی کیبورد را به انگلیسی تبدیل می‌کند (همان الگوی normalizePhone سمت سرور)
const toEnDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

type InviteTone = 'active' | 'used' | 'expired' | 'revoked'

function inviteStatus(inv: Invite): { label: string; tone: InviteTone } {
  if (!inv.is_active) return { label: 'باطل‌شده', tone: 'revoked' }
  if (inv.used_at) return { label: 'استفاده‌شده', tone: 'used' }
  if (new Date(inv.expires_at).getTime() < Date.now()) return { label: 'منقضی', tone: 'expired' }
  return { label: 'فعال', tone: 'active' }
}

const TONE_STYLE: Record<InviteTone, { bg: string; color: string }> = {
  active: { bg: '#e6f6ea', color: '#176a32' },
  used: { bg: '#e6ecf0', color: '#2a5a7a' },
  expired: { bg: '#f4efe6', color: '#8a6d3b' },
  revoked: { bg: '#fdeaea', color: '#8f2020' },
}

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #ccc',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  border: '1px solid #e5b5b5',
  color: '#8f2020',
}

export default function WalletPage() {
  const [phone, setPhone] = useState('')
  const [view, setView] = useState<WalletView | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [charging, setCharging] = useState(false)

  // 🎟 دعوت مشتری (QR / لینک) — لیست پایدار؛ QR و لینک هر ردیف همیشه در دسترس است
  const [inviteList, setInviteList] = useState<Invite[]>([])
  const [inviteBusy, setInviteBusy] = useState(false)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // 📥 درخواست‌های فعال‌سازی حضوری
  const [requests, setRequests] = useState<ActivationRequest[]>([])
  const [reviewBusy, setReviewBusy] = useState<string | null>(null)

  // 🧾 رسیدهای شارژ کارت‌به‌کارت
  const [chargeReqs, setChargeReqs] = useState<ChargeRequest[]>([])

  // ⚙️ تنظیمات کیف پول (سوییچ‌های سراسری)
  const [wset, setWset] = useState<WalletSettings | null>(null)
  const [setBusy, setSetBusy] = useState(false)

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wallet/requests', { cache: 'no-store', credentials: 'same-origin' })
      const json = await res.json()
      if (res.ok) {
        setRequests(json.activationRequests ?? [])
        setChargeReqs(json.chargeRequests ?? [])
      }
    } catch {}
  }, [])

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wallet/invites', { cache: 'no-store', credentials: 'same-origin' })
      const json = await res.json()
      if (res.ok) setInviteList(json.invites ?? [])
    } catch {}
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wallet/settings', { cache: 'no-store', credentials: 'same-origin' })
      const json = await res.json()
      if (res.ok) setWset(json)
    } catch {}
  }, [])

  useEffect(() => {
    loadRequests()
    loadInvites()
    loadSettings()
  }, [loadRequests, loadInvites, loadSettings])

  async function saveSettings() {
    if (!wset) return
    setSetBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/wallet/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          wallet_card_charge_enabled: wset.wallet_card_charge_enabled,
          wallet_charge_min: wset.wallet_charge_min,
          wallet_charge_max: wset.wallet_charge_max,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error || 'ذخیره ناموفق بود' })
      } else {
        setMsg({ kind: 'ok', text: 'تنظیمات کیف پول ذخیره شد ✓' })
        await loadSettings()
      }
    } catch {
      setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
    } finally {
      setSetBusy(false)
    }
  }

  async function createInvite() {
    setInviteBusy(true)
    try {
      const res = await fetch('/api/admin/wallet/invites', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const json = await res.json()
      if (res.ok && json.invite) {
        setQrToken(json.invite.token)
        await loadInvites()
      } else {
        setMsg({ kind: 'err', text: json.error || 'ساخت لینک ناموفق بود' })
      }
    } catch {
      setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
    } finally {
      setInviteBusy(false)
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm('این دعوت‌نامه باطل شود؟')) return
    try {
      await fetch(`/api/admin/wallet/invites?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      await loadInvites()
    } catch {}
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/register/${token}`
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopiedToken(token)
        setTimeout(() => setCopiedToken(null), 2000)
      },
      () => {}
    )
  }

  /** باز کردن کیف پول یک مشتری از داخل لیست دعوت‌نامه‌ها/درخواست‌ها */
  function openWalletFor(p: string) {
    setPhone(p)
    // load از state جدید استفاده می‌کند؛ مستقیم صدا می‌زنیم
    ;(async () => {
      setMsg(null)
      setView(null)
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/wallet?phone=${encodeURIComponent(p)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        const json = await res.json()
        if (res.ok) setView(json)
        else setMsg({ kind: 'err', text: json.error || 'خواندن ناموفق بود' })
      } catch {
        setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
      } finally {
        setLoading(false)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })()
  }

  async function reviewRequest(id: string, action: 'approve' | 'reject') {
    setReviewBusy(id)
    try {
      const res = await fetch('/api/admin/wallet/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, type: 'activation', action }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error || 'بررسی ناموفق بود' })
      } else {
        setMsg({
          kind: 'ok',
          text: action === 'approve' ? 'مشتری تأیید شد ✓ — کیف پولش فعال است' : 'درخواست رد شد',
        })
      }
      await loadRequests()
    } catch {
      setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
    } finally {
      setReviewBusy(null)
    }
  }

  /** تأیید/رد رسید شارژ — رد دلیل الزامی دارد (برای مشتری نمایش داده می‌شود) */
  async function reviewCharge(id: string, action: 'approve' | 'reject') {
    let rejectReason: string | undefined
    if (action === 'reject') {
      const input = prompt('دلیل رد (برای مشتری نمایش داده می‌شود):')
      if (input === null) return
      if (!input.trim()) {
        setMsg({ kind: 'err', text: 'برای رد کردن، نوشتن دلیل الزامی است' })
        return
      }
      rejectReason = input.trim()
    }
    setReviewBusy(id)
    try {
      const res = await fetch('/api/admin/wallet/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, type: 'charge', action, reject_reason: rejectReason }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error || 'بررسی ناموفق بود' })
      } else {
        setMsg({
          kind: 'ok',
          text: action === 'approve' ? 'رسید تأیید شد و کیف پول مشتری شارژ شد ✓' : 'درخواست شارژ رد شد',
        })
      }
      await loadRequests()
    } catch {
      setMsg({ kind: 'err', text: 'ارتباط با سرور برقرار نشد' })
    } finally {
      setReviewBusy(null)
    }
  }

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
      const parsed = Number(toEnDigits(amount).replace(/[^\d]/g, ''))
      const res = await fetch('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, amount: parsed, note }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error || 'شارژ ناموفق بود' })
        return
      }
      setMsg({ kind: 'ok', text: `کیف پول ${fmt(parsed)} تومانی شارژ شد ✓` })
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
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
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

      {/* ⚙️ تنظیمات کیف پول — سوییچ‌های سراسری */}
      <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 10, border: '1px solid #e5e0da' }}>
        <strong style={{ fontSize: 14 }}>⚙️ تنظیمات کیف پول</strong>
        {!wset ? (
          <p style={{ opacity: 0.6, fontSize: 13 }}>در حال بارگذاری…</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🏦 شارژ کارت‌به‌کارت توسط مشتری</div>
                <small style={{ opacity: 0.65, fontSize: 11.5, lineHeight: 1.8, display: 'block' }}>
                  وقتی روشن باشد، مشتری از تب کیف پول پنلش رسید واریز می‌فرستد و از همین صفحه تأییدش می‌کنی.
                </small>
              </div>
              <button
                type="button"
                className={`auto-switch ${wset.wallet_card_charge_enabled ? 'on' : 'off'}`}
                onClick={() => setWset({ ...wset, wallet_card_charge_enabled: !wset.wallet_card_charge_enabled })}
                disabled={setBusy}
              >
                <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 160, fontSize: 12 }}>
                کف شارژ (تومان)
                <input
                  type="number"
                  dir="ltr"
                  min={1000}
                  step={1000}
                  value={wset.wallet_charge_min}
                  onChange={(e) => setWset({ ...wset, wallet_charge_min: Math.max(0, Number(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13, marginTop: 4 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 160, fontSize: 12 }}>
                سقف شارژ (تومان)
                <input
                  type="number"
                  dir="ltr"
                  min={1000}
                  step={1000}
                  value={wset.wallet_charge_max}
                  onChange={(e) => setWset({ ...wset, wallet_charge_max: Math.max(0, Number(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13, marginTop: 4 }}
                />
              </label>
            </div>

            {wset.payment_transfer_card_number ? (
              <small style={{ display: 'block', opacity: 0.65, fontSize: 11.5, marginTop: 10 }}>
                کارت مقصدی که مشتری می‌بیند: <strong dir="ltr">{wset.payment_transfer_card_number}</strong>
                {wset.payment_transfer_bank_name ? ` (${wset.payment_transfer_bank_name})` : ''} — از{' '}
                <Link href="/admin/settings/payment" style={{ color: '#6f4e37' }}>تنظیمات پرداخت</Link> تغییرش بده.
              </small>
            ) : (
              <small style={{ display: 'block', color: '#8f2020', fontSize: 11.5, marginTop: 10 }}>
                ⚠️ هنوز شماره کارت مقصد تنظیم نشده — از{' '}
                <Link href="/admin/settings/payment" style={{ color: '#8f2020' }}>تنظیمات پرداخت → واریز به حساب</Link> شماره کارت را وارد کن؛
                تا آن موقع فرم شارژ برای مشتری باز نمی‌شود.
              </small>
            )}

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={saveSettings}
                disabled={setBusy}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: setBusy ? '#999' : '#6f4e37',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: setBusy ? 'default' : 'pointer',
                }}
              >
                {setBusy ? '…' : '💾 ذخیره تنظیمات'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 🎟 دعوت مشتری — لیست همه‌ی کدها با وضعیت */}
      <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 10, border: '1px solid #e5e0da' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14 }}>🎟 کدهای دعوت مشتری</strong>
          <button
            type="button"
            onClick={createInvite}
            disabled={inviteBusy}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: inviteBusy ? '#999' : '#6f4e37',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: inviteBusy ? 'default' : 'pointer',
            }}
          >
            {inviteBusy ? '…' : '+ ساخت کد جدید'}
          </button>
        </div>
        <p style={{ opacity: 0.65, fontSize: 12, lineHeight: 1.9, margin: '6px 0 0' }}>
          مشتری QR را اسکن می‌کند یا لینک را در پیام‌رسان می‌گیرد؛ با تکمیل فرم، حسابش فوراً تأیید و کیف پول فعال می‌شود.
          QR و لینک هر کد از همین لیست همیشه در دسترس است.
        </p>

        {inviteList.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13, marginTop: 10 }}>هنوز کد دعوتی ساخته نشده است.</p>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {inviteList.map((inv) => {
              const st = inviteStatus(inv)
              const showQr = qrToken === inv.token
              return (
                <div key={inv.id} style={{ border: '1px solid #e5e0da', borderRadius: 10, padding: '10px 12px', background: st.tone === 'active' ? '#fffdf7' : '#faf8f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <code dir="ltr" style={{ fontSize: 12, background: '#f7f2ec', padding: '3px 8px', borderRadius: 6 }}>
                        {inv.token.slice(0, 10)}…
                      </code>
                      <span style={{ background: TONE_STYLE[st.tone].bg, color: TONE_STYLE[st.tone].color, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                        {st.label}
                      </span>
                      <span style={{ opacity: 0.6, fontSize: 11 }}>
                        ساخته: {formatPersianDate(inv.created_at)} · مهلت: {formatPersianDate(inv.expires_at)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {st.tone === 'active' && (
                        <>
                          <button type="button" style={btnSecondary} onClick={() => setQrToken(showQr ? null : inv.token)}>
                            {showQr ? 'بستن QR' : 'QR'}
                          </button>
                          <button type="button" style={btnSecondary} onClick={() => copyInviteLink(inv.token)}>
                            {copiedToken === inv.token ? 'کپی شد ✓' : 'کپی لینک'}
                          </button>
                          <button type="button" style={btnDanger} onClick={() => revokeInvite(inv.id)}>
                            باطل کردن
                          </button>
                        </>
                      )}
                      {st.tone === 'used' && inv.used_phone && (
                        <>
                          <button type="button" style={btnSecondary} onClick={() => openWalletFor(inv.used_phone!)}>
                            👛 کیف پول
                          </button>
                          <Link href={`/admin/orders?phone=${encodeURIComponent(inv.used_phone)}`} style={{ ...btnSecondary, textDecoration: 'none' }}>
                            🧾 سفارش‌ها
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  {st.tone === 'used' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>📲 ثبت‌نام با: <strong dir="ltr">{inv.used_phone ?? '—'}</strong></span>
                      {inv.used_device_info && <span>📱 دستگاه: <strong>{inv.used_device_info}</strong></span>}
                    </div>
                  )}

                  {showQr && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ background: '#fff', padding: 10, borderRadius: 10, border: '1px solid #e5e0da' }}>
                        <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register/${inv.token}`} size={130} />
                      </div>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <code dir="ltr" style={{ display: 'block', fontSize: 11, background: '#f7f2ec', padding: '8px 10px', borderRadius: 8, wordBreak: 'break-all' }}>
                          {typeof window !== 'undefined' ? `${window.location.origin}/register/${inv.token}` : `/register/${inv.token}`}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 📥 درخواست‌های فعال‌سازی حضوری — لیست با دسترسی به پرونده و سفارش‌ها */}
      <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, border: '1px solid #e5e0da' }}>
        <strong style={{ fontSize: 14 }}>
          📥 درخواست‌های فعال‌سازی
          {requests.filter((r) => r.status === 'pending').length > 0 && (
            <span
              style={{
                marginRight: 8,
                background: '#8f2020',
                color: '#fff',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
              }}
            >
              {requests.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </strong>

        {requests.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13 }}>درخواستی ثبت نشده است.</p>
        ) : (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {requests.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e0da', fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {r.name || 'بدون نام'} — <span dir="ltr">{r.phone ?? '?'}</span>
                    {r.customer?.verification_status === 'verified' && (
                      <span style={{ background: '#e6f6ea', color: '#176a32', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>احرازشده ✓</span>
                    )}
                    {r.customer?.wallet_blocked && (
                      <span style={{ background: '#fdeaea', color: '#8f2020', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>کیف پول مسدود</span>
                    )}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 11 }}>
                    {formatPersianDate(r.created_at)}
                    {r.status !== 'pending' ? (r.status === 'approved' ? ' — تأییدشده ✓' : ' — رد‌شده ✗') : ''}
                    {r.customer?.device_info ? ` — 📱 ${r.customer.device_info}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {r.phone && (
                    <>
                      <Link href={`/admin/orders?phone=${encodeURIComponent(r.phone)}`} style={{ ...btnSecondary, textDecoration: 'none' }}>
                        🧾 سفارش‌ها
                      </Link>
                      <Link href={`/admin/customers?phone=${encodeURIComponent(r.phone)}`} style={{ ...btnSecondary, textDecoration: 'none' }}>
                        👤 پرونده
                      </Link>
                    </>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => reviewRequest(r.id, 'approve')}
                        disabled={reviewBusy === r.id}
                        style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        {reviewBusy === r.id ? '…' : 'تأیید حضوری'}
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewRequest(r.id, 'reject')}
                        disabled={reviewBusy === r.id}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5b5b5', background: '#fff', color: '#8f2020', fontSize: 12, cursor: 'pointer' }}
                      >
                        رد
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🧾 رسیدهای شارژ کارت‌به‌کارت — تأیید = شارژ واقعی کیف پول */}
      <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, border: '1px solid #e5e0da' }}>
        <strong style={{ fontSize: 14 }}>
          🧾 رسیدهای شارژ کارت‌به‌کارت
          {chargeReqs.filter((r) => r.status === 'pending').length > 0 && (
            <span
              style={{
                marginRight: 8,
                background: '#8f2020',
                color: '#fff',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
              }}
            >
              {chargeReqs.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </strong>

        {chargeReqs.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13 }}>درخواست شارژی ثبت نشده است.</p>
        ) : (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {chargeReqs.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e0da', fontSize: 13, background: r.status === 'pending' ? '#fffdf7' : '#faf8f5' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {fmt(r.amount)} تومان
                    {r.customer?.name && <span>— {r.customer.name}</span>}
                    {r.customer?.phone && <span dir="ltr" style={{ fontWeight: 'normal', opacity: 0.75 }}>{r.customer.phone}</span>}
                    {r.status === 'pending' && (
                      <span style={{ background: '#fff4d9', color: '#8a6d3b', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>در انتظار بررسی</span>
                    )}
                    {r.status === 'approved' && (
                      <span style={{ background: '#e6f6ea', color: '#176a32', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>تأییدشده ✓</span>
                    )}
                    {r.status === 'rejected' && (
                      <span style={{ background: '#fdeaea', color: '#8f2020', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>ردشده ✗</span>
                    )}
                    {r.customer?.card_charge_blocked && (
                      <span style={{ background: '#fdeaea', color: '#8f2020', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>شارژ مسدود</span>
                    )}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 11 }}>
                    {formatPersianDate(r.created_at)}
                    {r.tracking_no ? ` — پیگیری: ${r.tracking_no}` : ''}
                    {r.status === 'rejected' && r.reject_reason ? ` — دلیل: ${r.reject_reason}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {r.customer?.phone && (
                    <Link href={`/admin/customers?phone=${encodeURIComponent(r.customer.phone)}`} style={{ ...btnSecondary, textDecoration: 'none' }}>
                      👤 پرونده
                    </Link>
                  )}
                  {r.receipt_url && (
                    <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, textDecoration: 'none' }}>
                      🧾 دیدن رسید
                    </a>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => reviewCharge(r.id, 'approve')}
                        disabled={reviewBusy === r.id}
                        style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        {reviewBusy === r.id ? '…' : 'تأیید و شارژ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewCharge(r.id, 'reject')}
                        disabled={reviewBusy === r.id}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5b5b5', background: '#fff', color: '#8f2020', fontSize: 12, cursor: 'pointer' }}
                      >
                        رد
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
