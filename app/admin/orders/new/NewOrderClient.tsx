'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Category, Product } from '@/lib/menu-types'

const LEGACY_GROUP = 'بیرون بر'

// 🎯 پچ ۵۰-د: میزهای فعال از سرور می‌آیند (به‌جای تایپ شمارهٔ آزاد)
type PosTable = {
  id: string
  number: number
  name: string | null
  location: string | null
}

type Line = {
  product_id: string
  name: string
  option_id: string | null
  option_name: string | null
  unit_price: number
  quantity: number
  takeaway: boolean
  fee: number | null
}

// 🎯 پچ ۵۰-هـ: مشتری — جستجوی عضو + خلاصهٔ یک‌خطی + دعوت مهمان
type CustomerHit = {
  id: string
  phone: string
  name: string | null
  verification_status: string | null
}
type ActiveDiscount = {
  source: string
  label: string
  percent: number
  color: string | null
  orgName: string | null
  planName: string | null
  gradeName: string | null
}
type MemberInfo = {
  customer_name: string | null
  verification_status: string | null
  membership_label: string | null
  active: ActiveDiscount | null
  orgNote: string | null
}

const fmt = (n: number) => Number(n || 0).toLocaleString('fa-IR')
const lineKey = (l: Line) =>
  l.product_id + '|' + (l.option_id ?? '') + '|' + (l.takeaway ? 1 : 0)

function merge(lines: Line[]): Line[] {
  const map = new Map<string, Line>()
  for (const l of lines) {
    const k = lineKey(l)
    const ex = map.get(k)
    if (ex) ex.quantity += l.quantity
    else map.set(k, { ...l })
  }
  return [...map.values()]
}

// 🎯 پچ ۵۰-د: ارقام فارسی/عربی → انگلیسی — تخفیف با کیبورد فارسی هم کار می‌کند
function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

// 🎯 پچ ۵۰-هـ: پالت متمایز دسته‌ها — بر اساس ترتیب دسته‌ها، ثابت و قابل تشخیص
const CAT_COLORS = [
  '#6b4f3a', // قهوه‌ای برند
  '#4a7c9b', // آبی
  '#3f7d5c', // سبز
  '#b0722c', // نارنجی
  '#7b4a6d', // بنفش
  '#4a5d8a', // سرمه‌ای
  '#a34a4a', // قرمز آجری
  '#5d7a3a', // زیتونی
]

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e7dfd3',
  borderRadius: 12,
  padding: 14,
}
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d9cfc0',
  borderRadius: 10,
  font: 'inherit',
  boxSizing: 'border-box',
}
const smallBtn: React.CSSProperties = {
  border: '1px solid #d9cfc0',
  background: '#fff',
  borderRadius: 8,
  padding: '4px 10px',
  cursor: 'pointer',
  font: 'inherit',
}
// 🎯 پچ ۵۰-هـ-ب: حداقل تایپِ Web Speech API — فقط چیزی که جستجوی صوتی لازم دارد
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((e: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

// 🎯 پچ ۵۰-هـ-ب: تایل فشرده اما لمس‌پذیر — پس‌زمینه با کلاس .pos-tile تا دارک‌مود کار کند
const tile: React.CSSProperties = {
  border: '1px solid #e7dfd3',
  borderRadius: 10,
  padding: '8px 6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'center',
}
const chip = (active: boolean): React.CSSProperties => ({
  border: '1px solid ' + (active ? '#6b4f3a' : '#d9cfc0'),
  background: active ? '#6b4f3a' : '#fff',
  color: active ? '#fff' : 'inherit',
  borderRadius: 999,
  padding: '5px 14px',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  fontWeight: active ? 700 : 400,
  flexShrink: 0,
})
const badge = (bg: string, fg = '#fff'): React.CSSProperties => ({
  background: bg,
  color: fg,
  borderRadius: 999,
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
})
const memberDropdown: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  left: 0,
  marginTop: 4,
  background: '#fff',
  border: '1px solid #d9cfc0',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
  zIndex: 40,
  overflow: 'hidden',
}

// 🎯 پچ ۵۰-هـ: بازطراحی کامل صفحهٔ POS —
// جریان: اول مشتری (مهمان/عضو + تخفیف فعال)، بعد میز، بعد منو با تب‌های رنگی،
// سبد تک‌خطی فشرده و همه‌چیز در یک صفحه (فیت-پیج) با اسکرول داخلی.
export default function NewOrderClient({
  tables,
  categories,
  products,
}: {
  tables: PosTable[]
  categories: Category[]
  products: Product[]
}) {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')
  const [isTest, setIsTest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<number | null>(null)

  // 🎯 پچ ۵۰-د: انتخاب میز با چیپ + تخفیف دستی + مودال انتخاب گزینه
  const [selectedTable, setSelectedTable] = useState('')
  const [discount, setDiscount] = useState('')
  const [variantFor, setVariantFor] = useState<Product | null>(null)
  const [pickedOption, setPickedOption] = useState('')

  // 🎯 پچ ۵۰-هـ: مشتری — مهمان یا عضو
  const [customerMode, setCustomerMode] = useState<'guest' | 'member'>('guest')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [memberHits, setMemberHits] = useState<CustomerHit[]>([])
  const [memberSearching, setMemberSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CustomerHit | null>(null)
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null)

  // تخفیف عضو به‌صورت خودکار روی فاکتور جاری اعمال می‌شود؛ ویرایش دستی، حالت خودکار را خاموش می‌کند
  const [discountAuto, setDiscountAuto] = useState<'member' | null>(null)

  // 🎯 پچ ۵۰-هـ-ب: ارتفاع دقیق صفحه با اندازه‌گیری واقعی — تا منو/سبد تا نزدیک
  // ته ویوپورت کشیده شوند و فضای خالیِ پایین صفحه هدر نرود
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [posHeight, setPosHeight] = useState<number | null>(null)
  useEffect(() => {
    const measure = () => {
      const el = rootRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      setPosHeight(Math.max(520, Math.round(window.innerHeight - top - 24)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // دعوت‌نامهٔ عضویت برای مهمان
  const [invite, setInvite] = useState<{ token: string; expires_at: string } | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  // 🎯 پچ ۵۰-هـ-ب: شمارندهٔ سفارش‌های امروز کنار عنوان — بعد از هر ثبت موفق رفرش می‌شود
  const [todayStats, setTodayStats] = useState<{ count: number; revenue: number } | null>(null)
  function loadTodayStats() {
    fetch('/api/admin/orders/today-stats', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === 'number') setTodayStats(d)
      })
      .catch(() => {})
  }
  useEffect(() => {
    loadTodayStats()
  }, [])

  // 🎯 پچ ۵۰-هـ-ب: جستجوی صوتی — Chrome/Edge با fa-IR؛ بدون پشتیبانی مرورگر، دکمه پنهان می‌ماند
  const [listening, setListening] = useState(false)
  const [speechOk, setSpeechOk] = useState(false)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setSpeechOk(true)
  }, [])

  function toggleVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    if (listening) {
      recogRef.current?.stop()
      setListening(false)
      return
    }
    const r = new SR()
    r.lang = 'fa-IR'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const txt = e.results?.[0]?.[0]?.transcript ?? ''
      if (txt) setSearch(txt)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recogRef.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  // 🎯 پچ ۵۰-هـ-ب: رنگ + آیکون هر دسته — ثابت بر اساس ترتیب؛ آیکون = جایگزینِ عکسِ محصولات بی‌عکس
  const catMeta = useMemo(() => {
    const m = new Map<string, { color: string; icon: string | null }>()
    categories.forEach((c, i) =>
      m.set(c.id, { color: CAT_COLORS[i % CAT_COLORS.length], icon: c.icon || null })
    )
    return (id: string) => m.get(id) ?? { color: '#6b4f3a', icon: null }
  }, [categories])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        p.is_available !== false &&
        (cat === 'all' || p.category_id === cat) &&
        (!q || p.name.toLowerCase().includes(q))
    )
  }, [products, search, cat])

  // 🎯 پچ ۵۰-هـ-ب: ردیف «پیشنهاد ویژه» — فلگ پرفروش‌ها؛ افزودن با یک لمس
  const featured = useMemo(
    () => products.filter((p) => p.is_featured === true && p.is_available !== false),
    [products]
  )

  // 🎯 پچ ۵۰-هـ: جستجوی زندهٔ عضو با debounce — نام یا شماره
  useEffect(() => {
    if (customerMode !== 'member' || selectedMember) return
    const q = memberQuery.trim()
    if (q.length < 2) {
      setMemberHits([])
      return
    }
    setMemberSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          '/api/admin/customers/search?q=' + encodeURIComponent(q)
        )
        const data = await res.json().catch(() => ({}))
        setMemberHits(Array.isArray(data.customers) ? data.customers : [])
      } catch {
        setMemberHits([])
      } finally {
        setMemberSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [memberQuery, customerMode, selectedMember])

  function selectMember(hit: CustomerHit) {
    setSelectedMember(hit)
    setMemberHits([])
    setMemberQuery(hit.name ?? hit.phone)
    setMemberInfo(null)
    fetch(
      '/api/admin/customers/active-discount?phone=' + encodeURIComponent(hit.phone)
    )
      .then((res) => res.json())
      .then((data) => {
        setMemberInfo(data)
        setDiscountAuto(data?.active?.percent > 0 ? 'member' : null)
      })
      .catch(() => setMemberInfo(null))
  }

  function clearMember() {
    setSelectedMember(null)
    setMemberInfo(null)
    setMemberQuery('')
    setMemberHits([])
    setDiscountAuto(null)
  }

  function switchCustomerMode(mode: 'guest' | 'member') {
    setCustomerMode(mode)
    if (mode === 'guest') clearMember()
  }

  function optionsOf(p: Product) {
    return (p.variant_groups ?? [])
      .filter((g) => g.name.trim() !== LEGACY_GROUP)
      .flatMap((g) =>
        (g.variant_options ?? [])
          .filter((o) => o.is_available !== false)
          .map((o) => ({ ...o, group: g.name }))
      )
  }

  function add(p: Product, opt?: { id: string; name: string; price_modifier: number }) {
    const fee = p.takeaway_fee && p.takeaway_fee > 0 ? p.takeaway_fee : null
    const line: Line = {
      product_id: p.id,
      name: p.name,
      option_id: opt?.id ?? null,
      option_name: opt?.name ?? null,
      unit_price: opt ? Number(opt.price_modifier) : Number(p.price),
      quantity: 1,
      takeaway: false,
      fee,
    }
    setLines((prev) => merge([...prev, line]))
    setDone(null)
  }

  // 🎯 پچ ۵۰-د: مودال گزینه‌ها — با پیش‌انتخاب اولین گزینهٔ در دسترس
  function openVariant(p: Product) {
    const opts = optionsOf(p)
    setVariantFor(p)
    setPickedOption(opts[0]?.id ?? '')
  }

  function confirmVariant() {
    const p = variantFor
    if (!p) return
    const opts = optionsOf(p)
    if (opts.length > 0 && !pickedOption) return
    const opt = opts.find((o) => o.id === pickedOption)
    add(
      p,
      opt ? { id: opt.id, name: opt.name, price_modifier: opt.price_modifier } : undefined
    )
    setVariantFor(null)
    setPickedOption('')
  }

  function changeQty(k: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (lineKey(l) === k ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  function removeLine(k: string) {
    setLines((prev) => prev.filter((l) => lineKey(l) !== k))
  }

  function toggleTakeaway(k: string) {
    setLines((prev) =>
      merge(prev.map((l) => (lineKey(l) === k ? { ...l, takeaway: !l.takeaway } : l)))
    )
  }

  const base = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const fees = lines.reduce(
    (s, l) => s + (l.takeaway && l.fee ? l.fee * l.quantity : 0),
    0
  )
  const gross = base + fees
  const discountVal = Math.max(0, Math.floor(Number(normalizeDigits(discount) || 0) || 0))
  const total = Math.max(0, gross - discountVal)

  // 🎯 پچ ۵۰-هـ: تخفیف فعال عضو — خودکار هماهنگ با مبلغ فاکتور جاری
  const memberPct = memberInfo?.active?.percent ?? 0
  useEffect(() => {
    if (discountAuto !== 'member' || memberPct <= 0) return
    const amt = Math.round((gross * memberPct) / 100)
    setDiscount(amt > 0 ? String(amt) : '')
  }, [discountAuto, gross, memberPct])

  // 🎯 پچ ۵۰-هـ: دعوت‌نامهٔ عضویت برای مهمان — همان API پنل کیف پول
  async function createInvite() {
    setInviteBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/wallet/invites', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.invite?.token) {
        setInvite(data.invite)
        setInviteCopied(false)
      } else {
        setError(data.error || 'ساخت دعوت‌نامه ناموفق بود')
      }
    } catch {
      setError('خطای ارتباط با سرور')
    } finally {
      setInviteBusy(false)
    }
  }

  const inviteUrl = invite
    ? (typeof window !== 'undefined' ? window.location.origin : '') +
      '/register/' +
      invite.token
    : ''

  function copyInvite() {
    try {
      navigator.clipboard.writeText(inviteUrl)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    } catch {}
  }

  async function submit() {
    setError('')
    if (lines.length === 0) return setError('هیچ آیتمی انتخاب نشده است')
    if (discountVal > gross) return setError('تخفیف بیشتر از مبلغ سفارش است')
    setBusy(true)
    try {
      const res = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: selectedMember?.name ?? guestName,
          customer_phone: selectedMember?.phone ?? guestPhone,
          table_number: selectedTable === '' ? null : Number(selectedTable),
          note,
          is_test: isTest,
          manual_discount: discountVal,
          items: lines.map((l) => ({
            product_id: l.product_id,
            option_id: l.option_id,
            quantity: l.quantity,
            takeaway: l.takeaway,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'ثبت سفارش ناموفق بود')
      } else {
        setDone(data.order?.order_number ?? 0)
        loadTodayStats()
        setLines([])
        setGuestName('')
        setGuestPhone('')
        setNote('')
        setDiscount('')
        setDiscountAuto(null)
        clearMember()
      }
    } catch {
      setError('خطای ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="pos-root"
      ref={rootRef}
      style={posHeight ? { height: posHeight } : undefined}
    >
      <h1 className="pos-root-title">
        🧾 ثبت سفارش حضوری (POS)
        {/* 🎯 پچ ۵۰-هـ-ب: شمارندهٔ سفارش‌های امروز — بدون لغوشده و تستی */}
        {todayStats && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#6b4f3a',
              background: '#f3efe7',
              border: '1px solid #e3ddd2',
              borderRadius: 999,
              padding: '3px 10px',
              marginRight: 8,
              whiteSpace: 'nowrap',
            }}
          >
            📊 امروز: {fmt(todayStats.count)} سفارش
          </span>
        )}
      </h1>
      <p className="pos-root-sub">
        اول مشتری، بعد میز، بعد محصولات — همه‌چیز در یک صفحه.
      </p>

      {done !== null && (
        <div style={{ ...card, background: '#e8f1e9', padding: 10, flexShrink: 0 }}>
          ✅ سفارش شمارهٔ <strong>{fmt(done)}</strong> ثبت شد.{' '}
          <a href="/admin/orders" style={{ textDecoration: 'underline' }}>
            رفتن به سفارش‌ها
          </a>
        </div>
      )}

      {/* ─── 🎯 پچ ۵۰-هـ: ردیف مشتری — چسبان به بالا، با اسکرول ثابت ─── */}
      <section className="pos-customer-row">
        <span style={{ fontSize: 13, color: '#766f64', flexShrink: 0 }}>مشتری:</span>
        <button
          type="button"
          style={chip(customerMode === 'guest')}
          onClick={() => switchCustomerMode('guest')}
        >
          مهمان
        </button>
        <button
          type="button"
          style={chip(customerMode === 'member')}
          onClick={() => switchCustomerMode('member')}
        >
          عضو
        </button>

        {customerMode === 'guest' && (
          <>
            <input
              style={{ ...input, flex: '1 1 170px', width: 'auto' }}
              placeholder="نام مشتری (اختیاری)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <input
              style={{ ...input, flex: '1 1 150px', width: 'auto' }}
              placeholder="شمارهٔ تماس (اختیاری — برای پیامک)"
              inputMode="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
            />
            <button
              type="button"
              style={{ ...smallBtn, flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={createInvite}
              disabled={inviteBusy}
              title="ساخت لینک و QR دعوت به عضویت"
            >
              {inviteBusy ? '...' : '🔗 دعوت به عضویت'}
            </button>
          </>
        )}

        {customerMode === 'member' && !selectedMember && (
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <input
              style={input}
              placeholder="جستجوی عضو: نام یا شمارهٔ تماس…"
              inputMode="search"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
            {memberSearching && (
              <small style={{ position: 'absolute', left: 12, top: 10, color: '#766f64' }}>
                ⏳
              </small>
            )}
            {memberHits.length > 0 && (
              <div style={memberDropdown}>
                {memberHits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '9px 12px',
                      border: 0,
                      borderBottom: '1px solid #f0e9dd',
                      background: '#fff',
                      cursor: 'pointer',
                      font: 'inherit',
                      textAlign: 'right',
                    }}
                    onClick={() => selectMember(h)}
                  >
                    <strong>{h.name || 'بدون نام'}</strong>
                    <span dir="ltr" style={{ color: '#766f64', marginInlineStart: 8 }}>
                      {h.phone}
                    </span>
                    {h.verification_status === 'verified' ? (
                      <span style={{ color: '#3f7d5c', marginInlineStart: 8 }}>✅</span>
                    ) : (
                      <span style={{ color: '#b45309', marginInlineStart: 8 }}>⚠️</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {memberQuery.trim().length >= 2 && !memberSearching && memberHits.length === 0 && (
              <small style={{ display: 'block', marginTop: 4, color: '#766f64' }}>
                عضوی پیدا نشد — می‌توانی «مهمان» را انتخاب کنی.
              </small>
            )}
          </div>
        )}

        {customerMode === 'member' && selectedMember && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
            }}
          >
            <strong style={{ fontSize: 14 }}>
              {selectedMember.name || memberInfo?.customer_name || 'بدون نام'}
            </strong>
            <span dir="ltr" style={{ color: '#766f64', fontSize: 13 }}>
              {selectedMember.phone}
            </span>
            <span style={badge('#efe7da', '#6b4f3a')}>
              {memberInfo?.membership_label ?? '…'}
            </span>
            {memberPct > 0 && (
              <span
                style={badge(memberInfo?.active?.color ?? '#3f7d5c')}
                title={memberInfo?.active?.label ?? undefined}
              >
                🏷️ تخفیف فعال {fmt(memberPct)}٪ — خودکار روی فاکتور
              </span>
            )}
            {memberInfo?.orgNote && (
              <small style={{ color: '#b45309' }}>{memberInfo.orgNote}</small>
            )}
            <button type="button" style={{ ...smallBtn, flexShrink: 0 }} onClick={clearMember}>
              تغییر / حذف
            </button>
          </div>
        )}
      </section>

      <div className="pos-body">
        {/* ─── منو ─── */}
        <section className="pos-card">
          {/* انتخاب میز */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#766f64', flexShrink: 0 }}>میز:</span>
            <button
              type="button"
              style={chip(selectedTable === '')}
              onClick={() => setSelectedTable('')}
            >
              بدون میز
            </button>
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name ?? undefined}
                style={chip(selectedTable === String(t.number))}
                onClick={() => setSelectedTable(String(t.number))}
              >
                میز {t.number}
              </button>
            ))}
            {tables.length === 0 && (
              <small style={{ color: '#766f64', fontSize: 12 }}>
                هنوز میزی نساخته‌ای — بدون میز هم می‌شود ثبت کرد.
              </small>
            )}
          </div>

          {/* 🎯 پچ ۵۰-هـ-ب: جستجو + دکمهٔ میکروفون (اگر مرورگر پشتیبانی کند) */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <input
              style={{ ...input, marginTop: 0 }}
              placeholder="جستجوی محصول..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {speechOk && (
              <button
                type="button"
                title="جستجوی صوتی — اسم محصول را بگو"
                style={{
                  ...smallBtn,
                  flexShrink: 0,
                  padding: '0 12px',
                  fontSize: 15,
                  color: listening ? '#fff' : '#6b4f3a',
                  background: listening ? '#c0392b' : '#fff',
                  borderColor: listening ? '#c0392b' : '#e3ddd2',
                }}
                onClick={toggleVoice}
              >
                🎤
              </button>
            )}
          </div>
          {listening && (
            <small
              style={{ color: '#c0392b', fontSize: 11, display: 'block', marginTop: 4 }}
            >
              🎤 در حال شنود… اسم محصول را بگو (فارسی).
            </small>
          )}

          {/* 🎯 پچ ۵۰-هـ-ب: ردیف پیشنهاد ویژه — پرفروش‌ها با یک لمس */}
          {featured.length > 0 && (
            <div
              className="pos-featured-row"
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                flexShrink: 0,
                marginTop: 10,
              }}
            >
              {featured.map((p) => {
                const opts = optionsOf(p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="pos-tile pos-chip"
                    style={{
                      flexShrink: 0,
                      border: '1px solid #e3c98f',
                      background: '#fdf6ec',
                      color: '#6b4f3a',
                      borderRadius: 999,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                    onClick={() => (opts.length > 0 ? openVariant(p) : add(p))}
                  >
                    ⭐ {p.name} · {fmt(p.price)}
                  </button>
                )
              })}
            </div>
          )}

          {/* 🎯 پچ ۵۰-هـ: دسته‌ها به‌صورت تب رنگی بالای گرید */}
          <div className="pos-tab-row">
            <button
              type="button"
              className="pos-tab"
              style={{
                background: cat === 'all' ? '#6b4f3a' : '#fff',
                borderColor: '#6b4f3a',
                color: cat === 'all' ? '#fff' : '#6b4f3a',
                fontWeight: cat === 'all' ? 700 : 400,
              }}
              onClick={() => setCat('all')}
            >
              همه
            </button>
            {categories.map((c) => {
              const { color } = catMeta(c.id)
              const active = cat === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  className="pos-tab"
                  style={{
                    background: active ? color : '#fff',
                    borderColor: color,
                    color: active ? '#fff' : color,
                    fontWeight: active ? 700 : 400,
                  }}
                  onClick={() => setCat(c.id)}
                >
                  {c.icon ? c.icon + ' ' : ''}
                  {c.name}
                </button>
              )
            })}
          </div>

          {/* گرید تایل لمسی — هر تایل با رنگ دستهٔ خودش */}
          <div className="pos-menu-grid">
            {shown.map((p) => {
              const opts = optionsOf(p)
              const meta = catMeta(p.category_id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pos-tile"
                  style={{ ...tile, borderRight: '4px solid ' + meta.color }}
                  onClick={() => (opts.length > 0 ? openVariant(p) : add(p))}
                >
                  {/* 🎯 پچ ۵۰-هـ-ب: عکس محصول؛ اگر عکس ندارد، آیکون دسته‌اش */}
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      draggable={false}
                      style={{
                        width: '100%',
                        height: 62,
                        objectFit: 'cover',
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{meta.icon ?? '☕'}</span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#6b4f3a', fontWeight: 700 }}>
                    {opts.length > 0 ? 'انتخاب گزینه…' : fmt(p.price)}
                  </span>
                </button>
              )
            })}
            {shown.length === 0 && <p>محصولی پیدا نشد.</p>}
          </div>
        </section>

        {/* ─── سبد ─── */}
        <section className="pos-card">
          {/* 🎯 پچ ۵۰-هـ-ب: پاک کردن سریع سبد برای شروع فاکتور بعدی */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15 }}>🧾 سفارش ({fmt(lines.length)} ردیف)</h3>
            {lines.length > 0 && (
              <button
                type="button"
                style={{ ...smallBtn, fontSize: 12 }}
                title="پاک کردن همهٔ ردیف‌ها"
                onClick={() => setLines([])}
              >
                🧹 پاک کردن
              </button>
            )}
          </div>

          {lines.length === 0 && (
            <div style={{ textAlign: 'center', color: '#a89f8f', padding: '26px 10px' }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>🧾</div>
              <div style={{ fontSize: 13 }}>از منو انتخاب کن تا سفارش اینجا جمع شود.</div>
            </div>
          )}

          {/* 🎯 پچ ۵۰-هـ: هر آیتم در یک خط — استپر فشرده + مبلغ + حذف */}
          <div className="pos-cart-lines">
            {lines.map((l) => {
              const k = lineKey(l)
              return (
                <div className="pos-line" key={k}>
                  <div className="pos-line-name">
                    {l.name}
                    {l.option_name && (
                      <small style={{ color: '#766f64', fontWeight: 400 }}>
                        {' '}
                        ({l.option_name})
                      </small>
                    )}
                    {l.takeaway && l.fee ? (
                      <small style={{ color: '#b45309' }}> 🥡</small>
                    ) : null}
                  </div>
                  {l.fee ? (
                    <button
                      type="button"
                      title="بیرون‌بر"
                      style={{
                        ...smallBtn,
                        padding: '2px 7px',
                        fontSize: 13,
                        background: l.takeaway ? '#fdf0dc' : '#fff',
                        borderColor: l.takeaway ? '#b45309' : '#d9cfc0',
                        flexShrink: 0,
                      }}
                      onClick={() => toggleTakeaway(k)}
                    >
                      🥡
                    </button>
                  ) : null}
                  <div className="pos-step">
                    <button type="button" onClick={() => changeQty(k, -1)}>−</button>
                    <span className="pos-qty">{fmt(l.quantity)}</span>
                    <button type="button" onClick={() => changeQty(k, 1)}>+</button>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12.5,
                      flexShrink: 0,
                      minWidth: 66,
                      textAlign: 'left',
                    }}
                  >
                    {fmt(l.unit_price * l.quantity)}
                  </span>
                  <button
                    type="button"
                    title="حذف از سفارش"
                    style={{ ...smallBtn, padding: '2px 8px', flexShrink: 0 }}
                    onClick={() => removeLine(k)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <div className="pos-totals" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>جمع اقلام</span>
              <strong>{fmt(base)}</strong>
            </div>
            {fees > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>🥡 بیرون‌بر</span>
                <strong>{fmt(fees)}</strong>
              </div>
            )}
            {discountVal > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#b45309',
                }}
              >
                <span>
                  تخفیف
                  {discountAuto === 'member' && memberPct > 0
                    ? ` (${fmt(memberPct)}٪ عضو)`
                    : ' دستی'}
                </span>
                <strong>−{fmt(discountVal)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17 }}>
              <span>قابل پرداخت</span>
              <strong>{fmt(total)} تومان</strong>
            </div>
          </div>

          {/* تخفیف دستی، توضیحات و سفارش آزمایشی — تاشو تا فاکتور جمع‌وجور بماند */}
          <details style={{ marginTop: 8, flexShrink: 0 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#766f64' }}>
              ⚙️ تخفیف، توضیحات و گزینه‌ها
            </summary>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {discountAuto === 'member' && memberPct > 0 && (
                <small style={{ color: '#3f7d5c' }}>
                  تخفیف عضو ({fmt(memberPct)}٪) خودکار محاسبه می‌شود؛ اگر عدد را دستی
                  بنویسی، حالت خودکار خاموش می‌شود.
                </small>
              )}
              <input
                style={input}
                placeholder="تخفیف دستی (تومان) — اختیاری"
                inputMode="numeric"
                value={discount}
                onChange={(e) => {
                  setDiscount(normalizeDigits(e.target.value))
                  setDiscountAuto(null)
                }}
              />
              <textarea
                style={{ ...input, minHeight: 52 }}
                placeholder="توضیحات (اختیاری)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: isTest ? '1px solid #b45309' : '1px solid #d9cfc0',
                  background: isTest ? '#fdf0dc' : '#fff',
                }}
              >
                <input
                  type="checkbox"
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                />
                <span>🧪 سفارش آزمایشی (در گزارش‌ها حساب نشود)</span>
              </label>
            </div>
          </details>

          {error && <p className="danger" style={{ marginTop: 8 }}>{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy || lines.length === 0}
            style={{
              marginTop: 10,
              width: '100%',
              padding: 13,
              border: 0,
              borderRadius: 12,
              background: '#6b4f3a',
              color: '#fff',
              font: 'inherit',
              fontWeight: 700,
              cursor: busy || lines.length === 0 ? 'not-allowed' : 'pointer',
              opacity: busy || lines.length === 0 ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            {busy ? 'در حال ثبت...' : 'ثبت سفارش'}
          </button>
        </section>
      </div>

      {/* 🎯 پچ ۵۰-د: مودال انتخاب گزینهٔ محصول */}
      {variantFor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setVariantFor(null)}
        >
          <div
            style={{
              background: '#fff',
              color: '#333',
              borderRadius: 14,
              padding: 16,
              maxWidth: 420,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px' }}>{variantFor.name}</h3>
            <p style={{ margin: '0 0 10px', color: '#766f64', fontSize: 13 }}>
              گزینه را انتخاب کن:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {optionsOf(variantFor).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  style={chip(pickedOption === o.id)}
                  onClick={() => setPickedOption(o.id)}
                >
                  {o.group ? o.group + ' · ' : ''}
                  {o.name} ({fmt(o.price_modifier)})
                </button>
              ))}
            </div>
            {optionsOf(variantFor).length === 0 && (
              <p style={{ color: '#b45309' }}>گزینه‌ای در دسترس نیست.</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={confirmVariant}
                style={{
                  flex: 1,
                  padding: 12,
                  border: 0,
                  borderRadius: 10,
                  background: '#6b4f3a',
                  color: '#fff',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                افزودن به سفارش
              </button>
              <button type="button" style={smallBtn} onClick={() => setVariantFor(null)}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 پچ ۵۰-هـ: مودال دعوت‌نامهٔ عضویت — لینک + QR برای اسکن با گوشی مشتری */}
      {invite && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setInvite(null)}
        >
          <div
            style={{
              background: '#fff',
              color: '#333',
              borderRadius: 14,
              padding: 16,
              maxWidth: 360,
              width: '100%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px' }}>🔗 دعوت‌نامهٔ عضویت</h3>
            <p style={{ margin: '0 0 10px', color: '#766f64', fontSize: 13 }}>
              مشتری با گوشی‌اش QR را اسکن کند یا لینک را باز کند (۷ روز اعتبار).
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <QRCodeSVG value={inviteUrl} size={150} />
            </div>
            <code
              dir="ltr"
              style={{
                display: 'block',
                fontSize: 11.5,
                background: '#f7f3eb',
                borderRadius: 8,
                padding: '8px 10px',
                wordBreak: 'break-all',
              }}
            >
              {inviteUrl}
            </code>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={copyInvite}
                style={{
                  flex: 1,
                  padding: 11,
                  border: 0,
                  borderRadius: 10,
                  background: '#6b4f3a',
                  color: '#fff',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {inviteCopied ? 'کپی شد ✓' : 'کپی لینک'}
              </button>
              <button type="button" style={smallBtn} onClick={() => setInvite(null)}>
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
