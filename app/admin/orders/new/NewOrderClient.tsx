'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import AdminSplitPayment from '@/app/admin/components/AdminSplitPayment'
import type { Category, Product } from '@/lib/menu-types'
import {
  toJalaali,
  toGregorian,
  jalaaliMonthLength,
  JALALI_MONTHS,
  pad2,
  formatJalali,
} from '@/lib/jalali'

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
  note?: string | null
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
  orgRemainingToday: number | null
  orgTotalRemaining: number | null
}

// 🎯 پچ ۵۰-هـ-و: سفارش امروز برای «لیست سفارش‌ها» و ویرایش — از /api/admin/orders/recent
type PosOrderItem = {
  product_id: string
  product_name: string
  option_id: string | null
  option_name: string | null
  unit_price: number
  quantity: number
  takeaway?: boolean
  takeaway_fee?: number | null
  line_note?: string | null
}
type PosOrderRow = {
  id: string
  order_number: number
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  table_number: number | null
  source: string | null
  status: string
  payment_status?: string | null
  payment_method?: string | null
  subtotal: number
  coupon_code: string | null
  coupon_discount: number | null
  manual_discount?: number | null
  paid_amount?: number | null
  note?: string | null
  is_test?: boolean
  items: PosOrderItem[]
  // 🎯 پچ ۵۰-هـ-خ: سفارش ضمیمه — والدِ این سفارش
  parent_order_id?: string | null
  // 🎯 پچ ۵۰-هـ-ح: پرداخت‌های ثبت‌شده برای نمایش تسویه روی فیش‌ها (embed سوپابیس)
  order_payments?: Array<{ method: string | null; amount: number; status: string | null }> | null
}
const POS_STATUS_LABELS: Record<string, string> = {
  pending: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده تحویل',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}
const POS_STATUS_COLORS: Record<string, string> = {
  pending: '#9a6b3f',
  confirmed: '#4a7c9b',
  preparing: '#b0722c',
  ready: '#3f7d5c',
  delivered: '#6b6b6b',
  cancelled: '#9b3c32',
}

// ─── 🎯 پچ ۵۰-هـ-ح: تسویه و اطلاعات چاپ ───

// اطلاعات عضویت/گرید مشتری — هنگام باز شدن مودال چاپ از active-discount گرفته می‌شود
type PrintExtra = {
  title: string
  gradeName: string | null
  activePercent: number
  activeLabel: string | null
}

// پرداخت‌های تأییدشدهٔ سفارش (برای فیش‌ها و ردیف‌ها)
function confirmedPayments(o: PosOrderRow) {
  return (o.order_payments ?? []).filter(
    (p) => (p.status ?? 'confirmed') === 'confirmed' && Number(p.amount) > 0
  )
}
function paymentMethodLabel(m: string | null): string {
  if (!m) return '—'
  // 🎯 پچ ۵۰-هـ-او: برچسب‌ها محلی نگه داشته شدند (وابستگی به lib حذف شد)
  const labels: Record<string, string> = {
    cash: '💵 نقدی',
    card: '💳 کارت‌خوان',
    online: '🌐 درگاه آنلاین',
    transfer: '🏦 کارت‌به‌کارت',
    wallet: '👛 کیف پول',
  }
  return labels[m] ?? m
}
// وضعیت تسویه: از جمع پرداخت‌های تأییدشده، وگرنه از ستون paid_amount
function settlementOf(o: PosOrderRow): {
  state: 'paid' | 'partial' | 'none'
  paid: number
  remaining: number
} {
  const rows = confirmedPayments(o)
  const paid = Math.round(
    rows.length > 0
      ? rows.reduce((s, p) => s + Number(p.amount), 0)
      : Number(o.paid_amount) || 0
  )
  const remaining = Math.max(0, Math.round(Number(o.subtotal) || 0) - paid)
  if (paid <= 0) return { state: 'none', paid: 0, remaining }
  if (remaining <= 0) return { state: 'paid', paid, remaining: 0 }
  return { state: 'partial', paid, remaining }
}

const fmt = (n: number) => Number(n || 0).toLocaleString('fa-IR')
const lineKey = (l: Line) =>
  l.product_id + '|' + (l.option_id ?? '') + '|' + (l.takeaway ? 1 : 0)

function merge(lines: Line[]): Line[] {
  const map = new Map<string, Line>()
  for (const l of lines) {
    const k = lineKey(l)
    const ex = map.get(k)
    if (ex) {
      ex.quantity += l.quantity
      // 🎯 پچ ۵۰-هـ-د: پیام دو ردیفِ هم‌نام در یک خط ترکیب می‌شود
      if (l.note && l.note !== ex.note) {
        ex.note = ex.note ? ex.note + '؛ ' + l.note : l.note
      }
    } else map.set(k, { ...l })
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
// 🎯 پچ ۵۰-هـ-او: پنجرهٔ شمارهٔ صفحات — حداکثر ۷ دکمه با «…» بین بازه‌ها
function pageWindow(page: number, pages: number): Array<number | '…'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: Array<number | '…'> = [1]
  const s = Math.max(2, page - 1)
  const e = Math.min(pages - 1, page + 1)
  if (s > 2) out.push('…')
  for (let i = s; i <= e; i++) out.push(i)
  if (e < pages - 1) out.push('…')
  out.push(pages)
  return out
}

// 🎯 پچ ۵۰-هـ-وِی: انتخابگر تاریخ شمسی فشرده (روز/ماه/سال) — خروجی میلادی برای API
// مقادیر نمایشی وقتی بازه خالی است «امروز» است (همان رفتار پیش‌فرض API)
function JalaliDateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (gregorian: string) => void
}) {
  const now = new Date()
  const nowJ = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  let jy = nowJ.jy
  let jm = nowJ.jm
  let jd = nowJ.jd
  if (value) {
    const [y, m, d] = value.split('-').map(Number)
    if (y && m && d) {
      const j = toJalaali(y, m, d)
      jy = j.jy
      jm = j.jm
      jd = j.jd
    }
  }
  const commit = (yy: number, mm: number, dd: number) => {
    const g = toGregorian(yy, mm, Math.min(dd, jalaaliMonthLength(yy, mm)))
    onChange(`${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`)
  }
  const faNum = (n: number) => n.toLocaleString('fa-IR')
  const selStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '3px 4px',
    borderRadius: 8,
    border: '1px solid #e3ddd2',
    font: 'inherit',
    color: '#4b443b',
    background: '#fff',
  }
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select
        style={selStyle}
        value={jd}
        onChange={(e) => commit(jy, jm, Number(e.target.value))}
        aria-label="روز شمسی"
      >
        {Array.from({ length: jalaaliMonthLength(jy, jm) }, (_, i) => i + 1).map(
          (d) => (
            <option key={d} value={d}>
              {faNum(d)}
            </option>
          )
        )}
      </select>
      <select
        style={selStyle}
        value={jm}
        onChange={(e) => commit(jy, Number(e.target.value), jd)}
        aria-label="ماه شمسی"
      >
        {JALALI_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {faNum(i + 1)} {name}
          </option>
        ))}
      </select>
      <select
        style={selStyle}
        value={jy}
        onChange={(e) => commit(Number(e.target.value), jm, jd)}
        aria-label="سال شمسی"
      >
        {[nowJ.jy - 1, nowJ.jy, nowJ.jy + 1].map((y) => (
          <option key={y} value={y}>
            {faNum(y)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function NewOrderClient({
  tables,
  categories,
  products,
  cafeName,
  logoUrl,
}: {
  tables: PosTable[]
  categories: Category[]
  products: Product[]
  cafeName?: string | null
  logoUrl?: string | null
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

  // 🎯 پچ ۵۰-هـ-د: پیام‌های آماده — یکبار تعریف، روی هر ردیف (کافه و غذا)
  const [quickNotes, setQuickNotes] = useState<string[]>([])
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [newQuick, setNewQuick] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)

  // 🎯 پچ ۵۰-هـ-د: ارسال لینک دعوت با پیامک — تا تنظیمات پیامک کامل نشود غیرفعال
  const [smsOk, setSmsOk] = useState(false)
  const [smsBusy, setSmsBusy] = useState(false)
  const [smsMsg, setSmsMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // 🎯 پچ ۵۰-هـ-د: تاریخ و ساعت زندهٔ تهران — سمت چپ، بالای بج امروز
  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 20_000)
    return () => clearInterval(t)
  }, [])

  // 🎯 پچ ۵۰-هـ-و: لیست سفارش‌های امروز + ویرایش تا قبل از آماده‌سازی
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [ordersList, setOrdersList] = useState<PosOrderRow[]>([])
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'admin' | 'online'>('all')
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersErr, setOrdersErr] = useState('')
  // 🎯 پچ ۵۰-هـ-او: فیلتر بازهٔ تاریخ + صفحه‌بندی لیست سفارش‌ها
  const [listFrom, setListFrom] = useState('') // '' = امروز تهران
  const [listTo, setListTo] = useState('') // '' = بدون سقف
  const [listPage, setListPage] = useState(1)
  const [listPages, setListPages] = useState(1)
  const [listTotal, setListTotal] = useState(0)
  const [editing, setEditing] = useState<PosOrderRow | null>(null)

  // 🎯 پچ ۵۰-هـ-ز: کیوسک، چاپ، نوار زندهٔ آشپزخانه و بوق سفارش آنلاین
  const [kiosk, setKiosk] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [printing, setPrinting] = useState<PosOrderRow | null>(null)
  const [printJob, setPrintJob] = useState<{
    order: PosOrderRow
    target: 'kitchen' | 'hall' | 'customer'
    extra?: PrintExtra | null
  } | null>(null)
  const lastPendingRef = useRef<number | null>(null)
  // 🎯 پچ ۵۰-هـ-ح: باز/بستهٔ ریز اقلام هر ردیف + اطلاعات عضویت برای چاپ
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [printExtra, setPrintExtra] = useState<PrintExtra | null>(null)
  const extraCacheRef = useRef<Map<string, PrintExtra | null>>(new Map())
  // 🎯 پچ ۵۰-هـ-خ: سفارش ضمیمه + نمای منو (تصویری/متنی) + ثبت پرداخت در ردیف
  const [supplementFor, setSupplementFor] = useState<PosOrderRow | null>(null)
  const [menuView, setMenuView] = useState<'img' | 'text'>('img')
  // 🎯 پچ ۵۰-هـ-وِی: پرداخت با دکمهٔ ردیفی + مودال — پنل ترکیبی (AdminSplitPayment)
  // پچ ۵۰-هـ-او: stateهای payMethodSel/payAmount/payBusy/payMsg حذف شدند
  const [payModalOrder, setPayModalOrder] = useState<PosOrderRow | null>(null)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('pos_menu_view')
      if (saved === 'text' || saved === 'img') setMenuView(saved)
    } catch {}
  }, [])
  function changeMenuView(v: 'img' | 'text') {
    setMenuView(v)
    try {
      window.localStorage.setItem('pos_menu_view', v)
    } catch {}
  }

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

  // 🎯 پچ ۵۰-هـ-د: پیام‌های آماده + وضعیت تنظیمات پیامک
  useEffect(() => {
    fetch('/api/admin/pos-quick-notes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.notes)) setQuickNotes(d.notes)
      })
      .catch(() => {})
    fetch('/api/admin/invites/sms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSmsOk(d?.configured === true))
      .catch(() => {})
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

  // 🎯 پچ ۵۰-هـ-د: نقشهٔ مشمولیت تخفیف — محصول و دسته (همان قانون سرور)
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const catElig = useMemo(
    () => new Map(categories.map((c) => [c.id, c.coupon_eligible])),
    [categories]
  )

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        p.is_available !== false &&
        // 🎯 پچ ۵۰-هـ-خ: «اقلام پر سفارش» به‌صورت چیپ ثابت اول دسته‌ها
        (cat === 'all' || (cat === '__featured' ? p.is_featured === true : p.category_id === cat)) &&
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
      note: null,
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

  // 🎯 پچ ۵۰-هـ-د: اقلام مشمول تخفیف — همان قانون سرور: فلگ محصول، وگرنه فلگ دسته.
  // تخفیف فقط روی همین بخش محاسبه می‌شود؛ اقلام غیرمشمول جدا و دست‌نخورده می‌مانند.
  const isEligible = (l: Line) => {
    const p = productMap.get(l.product_id)
    if (!p) return true
    if (p.coupon_eligible === true) return true
    if (p.coupon_eligible === false) return false
    return catElig.get(p.category_id) !== false
  }
  const eligibleBase = lines.reduce(
    (s, l) => (isEligible(l) ? s + l.unit_price * l.quantity : s),
    0
  )
  const ineligibleBase = base - eligibleBase
  const discountVal = Math.max(0, Math.floor(Number(normalizeDigits(discount) || 0) || 0))
  const total = Math.max(0, gross - discountVal)

  // 🎯 پچ ۵۰-هـ: تخفیف فعال عضو — خودکار هماهنگ با مبلغ فاکتور جاری
  const memberPct = memberInfo?.active?.percent ?? 0
  useEffect(() => {
    if (discountAuto !== 'member' || memberPct <= 0) return
    const amt = Math.round((eligibleBase * memberPct) / 100)
    setDiscount(amt > 0 ? String(amt) : '')
  }, [discountAuto, eligibleBase, memberPct])

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

  // 🎯 پچ ۵۰-هـ-د: ارسال لینک دعوت با پیامک برای مهمانِ حاضر
  const invitePhoneOk = /^09\d{9}$/.test(normalizeDigits(guestPhone))
  async function sendInviteSms() {
    if (!invite || !invitePhoneOk) return
    setSmsBusy(true)
    setSmsMsg(null)
    try {
      const res = await fetch('/api/admin/invites/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token, phone: normalizeDigits(guestPhone) }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) setSmsMsg({ ok: true, text: '📨 پیامک با موفقیت ارسال شد' })
      else setSmsMsg({ ok: false, text: data?.error || 'ارسال پیامک ناموفق بود' })
    } catch {
      setSmsMsg({ ok: false, text: 'خطای ارتباط با سرور' })
    } finally {
      setSmsBusy(false)
    }
  }

  // 🎯 پچ ۵۰-هـ-د: مدیریت پیام‌های آماده — افزودن/حذف + انتخاب برای ردیف
  function setLineNote(k: string, n: string) {
    const v = n.trim()
    setLines((prev) =>
      prev.map((l) => (lineKey(l) === k ? { ...l, note: v || null } : l))
    )
    setNoteFor(null)
  }
  async function addQuickNote() {
    const t = newQuick.trim()
    if (!t || quickBusy) return
    setQuickBusy(true)
    try {
      const res = await fetch('/api/admin/pos-quick-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: t }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data?.notes)) {
        setQuickNotes(data.notes)
        setNewQuick('')
      }
    } catch {}
    setQuickBusy(false)
  }
  async function delQuickNote(n: string) {
    if (quickBusy) return
    setQuickBusy(true)
    try {
      const res = await fetch('/api/admin/pos-quick-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove: n }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data?.notes)) setQuickNotes(data.notes)
    } catch {}
    setQuickBusy(false)
  }

  // 🎯 پچ ۵۰-هـ-و: سفارش‌های امروز + ورود به حالت ویرایش
  // 🎯 پچ ۵۰-هـ-او: لیست سفارش‌ها با بازهٔ تاریخ و صفحه‌بندی سرورسمت (۱۰ در صفحه)
  async function loadOrders(opts?: { page?: number; from?: string; to?: string }) {
    setOrdersLoading(true)
    setOrdersErr('')
    const page = opts?.page ?? listPage
    const from = opts?.from ?? listFrom
    const to = opts?.to ?? listTo
    const params = new URLSearchParams({ page: String(page), pageSize: '10' })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    try {
      const res = await fetch('/api/admin/orders/recent?' + params.toString(), {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data?.orders)) {
        setOrdersList(data.orders)
        setListTotal(Number(data.total ?? data.orders.length))
        setListPages(Math.max(1, Number(data.pages ?? 1)))
        setListPage(Math.max(1, Number(data.page ?? page)))
      } else {
        setOrdersErr(data?.error || 'دریافت سفارش‌ها ناموفق بود')
      }
    } catch {
      setOrdersErr('خطای ارتباط با سرور')
    } finally {
      setOrdersLoading(false)
    }
  }
  function openOrders() {
    setOrdersOpen(true)
    loadOrders()
  }
  function isOrderEditable(o: PosOrderRow) {
    return (o.status === 'pending' || o.status === 'confirmed') && o.payment_status !== 'paid'
  }
  function editBlockReason(o: PosOrderRow) {
    if (o.status === 'cancelled') return 'سفارش لغو شده — قابل ویرایش نیست'
    if (o.payment_status === 'paid') return 'تسویه‌شده — قابل ویرایش نیست'
    if (o.status !== 'pending' && o.status !== 'confirmed')
      return 'آماده‌سازی شروع شده — قابل ویرایش نیست'
    return 'ویرایش سفارش'
  }
  // 🎯 پچ ۵۰-هـ-ز: تکرار سفارش — همان بارگیری ولی به‌عنوان سفارش جدید (asNew)
  function startEdit(o: PosOrderRow, asNew = false) {
    if (!asNew && !isOrderEditable(o)) return
    setLines(
      o.items.map((it) => ({
        product_id: it.product_id,
        name: it.product_name,
        option_id: it.option_id,
        option_name: it.option_name,
        unit_price: Number(it.unit_price) || 0,
        quantity: it.quantity,
        takeaway: it.takeaway === true,
        fee: it.takeaway_fee ? Number(it.takeaway_fee) : null,
        note: it.line_note ?? null,
      }))
    )
    setCustomerMode('guest')
    setGuestName(
      o.customer_name && o.customer_name !== 'مهمان' && o.customer_name !== 'مشتری'
        ? o.customer_name
        : ''
    )
    setGuestPhone(o.customer_phone ?? '')
    setSelectedTable(o.table_number == null ? '' : String(o.table_number))
    // توضیحات قبلی منهای خط‌های خودکار پیام‌های آماده — تا موقع ثبت دوباره اضافه شوند
    const agg = new Set(
      o.items
        .filter((it) => (it.line_note ?? '').trim())
        .map(
          (it) =>
            `${it.product_name}${it.option_name ? ' (' + it.option_name + ')' : ''} ×${fmt(it.quantity)}: ${it.line_note!.trim()}`
        )
    )
    setNote(
      (o.note ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !agg.has(l))
        .join('\n')
    )
    if ((o.coupon_discount ?? 0) > 0) {
      setDiscount(String(o.coupon_discount))
      setDiscountAuto(o.coupon_code === 'MEMBERSHIP' ? 'member' : null)
    } else {
      setDiscount('')
      setDiscountAuto(null)
    }
    setDone(null)
    setError('')
    setOrdersOpen(false)
    if (!asNew) setEditing(o)
    rootRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }
  function cancelEdit() {
    setEditing(null)
    setLines([])
    setNote('')
    setDiscount('')
    setDiscountAuto(null)
    setGuestName('')
    setGuestPhone('')
    setSelectedTable('')
    setCustomerMode('guest')
    setError('')
    setSupplementFor(null)
  }

  // ─── 🎯 پچ ۵۰-هـ-خ: سفارش ضمیمه — اقلام جدید وابسته به سفارش تمام‌شده ───
  function startSupplement(o: PosOrderRow) {
    setEditing(null)
    setLines([])
    setNote('')
    setDiscount('')
    setDiscountAuto(null)
    setSupplementFor(o)
    // مشتری و میز از سفارش اصلی به ارث می‌رسد
    const phone = String(o.customer_phone ?? '').replace(/\D/g, '')
    if (/^09\d{9}$/.test(phone)) {
      setCustomerMode('member')
      setSelectedMember({
        id: '',
        phone: o.customer_phone!,
        name: o.customer_name ?? null,
        verification_status: null,
      })
      setMemberQuery(o.customer_name ?? o.customer_phone ?? '')
      // اطلاعات عضویت/تخفیف فعال همان مشتری
      fetch('/api/admin/customers/active-discount?phone=' + encodeURIComponent(phone))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setMemberInfo(data)
          setDiscountAuto(data?.active?.percent > 0 ? 'member' : null)
        })
        .catch(() => setMemberInfo(null))
    } else if (o.customer_name && o.customer_name !== 'مهمان' && o.customer_name !== 'مشتری') {
      setCustomerMode('guest')
      setGuestName(o.customer_name)
      setGuestPhone('')
    } else {
      setCustomerMode('guest')
      setGuestName('')
      setGuestPhone('')
    }
    setSelectedTable(o.table_number == null ? '' : String(o.table_number))
    setDone(null)
    setError('')
    setOrdersOpen(false)
    rootRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  function cancelSupplement() {
    setSupplementFor(null)
    setLines([])
    setNote('')
    setDiscount('')
    setDiscountAuto(null)
    setGuestName('')
    setGuestPhone('')
    setSelectedTable('')
    setCustomerMode('guest')
    setError('')
  }

  // 🎯 پچ ۵۰-هـ-او: تابع submitPayment تک‌روشی حذف شد — ثبت پرداخت حالا در
  // کامپوننت AdminSplitPayment انجام می‌شود (تقسیم مبلغ بین روش‌ها یا کل مبلغ)

  // ─── 🎯 پچ ۵۰-هـ-ز: کیوسک، بوق سفارش آنلاین، نوار زنده و چاپ ───
  function toggleKiosk() {
    const next = !kiosk
    setKiosk(next)
    document.documentElement.classList.toggle('pos-kiosk', next)
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }
  useEffect(() => () => document.documentElement.classList.remove('pos-kiosk'), [])

  function playNewOrderChime() {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      const ctx = new Ctx()
      ctx.resume().catch(() => {})
      const t0 = ctx.currentTime
      ;[880, 1180].forEach((f, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0.001, t0 + i * 0.25)
        g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.25 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.25 + 0.22)
        o.connect(g)
        g.connect(ctx.destination)
        o.start(t0 + i * 0.25)
        o.stop(t0 + i * 0.25 + 0.3)
      })
      setTimeout(() => ctx.close().catch(() => {}), 1200)
    } catch {}
  }

  // پایهٔ نوار زنده + هر ۶۰ ثانیه (فقط وقتی تب دیده می‌شود)
  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadOrders()
    }, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // بوق سفارش آنلاین جدید — مقایسهٔ تعداد «در انتظار تأیید» با دفعات قبل
  const livePreparing = ordersList.filter((o) => o.status === 'preparing').length
  const liveReady = ordersList.filter((o) => o.status === 'ready').length
  const livePendingOnline = ordersList.filter(
    (o) => o.source !== 'admin' && o.status === 'pending'
  ).length
  useEffect(() => {
    if (lastPendingRef.current === null) {
      lastPendingRef.current = livePendingOnline
      return
    }
    if (soundOn && livePendingOnline > lastPendingRef.current) playNewOrderChime()
    lastPendingRef.current = livePendingOnline
  }, [livePendingOnline, soundOn])

  // 🎯 پچ ۵۰-هـ-ح: باز کردن چاپ + گرفتن عنوان عضویت/گرید مشتری (با کش per phone)
  async function openPrint(o: PosOrderRow) {
    setPrinting(o)
    setPrintExtra(null)
    const phone = String(o.customer_phone ?? '').replace(/\D/g, '')
    if (!/^09\d{9}$/.test(phone)) return
    const cached = extraCacheRef.current.get(phone)
    if (cached !== undefined) {
      setPrintExtra(cached)
      return
    }
    try {
      const res = await fetch(
        '/api/admin/customers/active-discount?phone=' + encodeURIComponent(phone),
        { cache: 'no-store' }
      )
      const d = res.ok ? await res.json() : null
      const orgName: string | null = d?.active?.orgName ?? null
      const gradeName: string | null = d?.active?.gradeName ?? null
      const pct = Number(d?.active?.percent) || 0
      const extra: PrintExtra = {
        title: orgName
          ? `عضو سازمان${orgName ? ` «${orgName}»` : ''}`
          : d?.membership_label
            ? String(d.membership_label)
            : 'مشتری عادی',
        gradeName: gradeName ?? null,
        activePercent: pct,
        activeLabel:
          pct > 0
            ? d?.active?.planName
              ? `${d.active.planName} — ${pct}٪`
              : `تخفیف فعال ${pct}٪`
            : null,
      }
      extraCacheRef.current.set(phone, extra)
      setPrintExtra(extra)
    } catch {
      // بدون اطلاعات عضویت هم چاپ انجام می‌شود
    }
  }

  // چاپ: بعد از انتخاب مقصد، فیش رندر و دیالوگ چاپ باز می‌شود
  useEffect(() => {
    if (!printJob) return
    const handleAfterPrint = () => setPrintJob(null)
    window.addEventListener('afterprint', handleAfterPrint)
    const t = setTimeout(() => window.print(), 350)
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      clearTimeout(t)
    }
  }, [printJob])

  async function submit() {
    setError('')
    if (lines.length === 0) return setError('هیچ آیتمی انتخاب نشده است')
    if (discountVal > eligibleBase)
      return setError(
        'تخفیف نمی‌تواند بیشتر از اقلام مشمول تخفیف (' + fmt(eligibleBase) + ' تومان) باشد'
      )
    setBusy(true)
    try {
      // 🎯 پچ ۵۰-هـ-و: منبع تخفیف در حالت ویرایش از کد ثبت‌شدهٔ فاکتور می‌آید
      const discountSource = editing
        ? editing.coupon_code === 'MEMBERSHIP'
          ? 'org'
          : editing.coupon_code === 'SUBSCRIPTION'
            ? 'subscription'
            : editing.coupon_code === 'GRADE'
              ? 'grade'
              : null
        : discountAuto === 'member' && memberPct > 0
          ? memberInfo?.active?.source ?? null
          : null
      const res = await fetch(
        editing ? `/api/admin/orders/${editing.id}/update` : '/api/admin/orders/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: selectedMember?.name ?? guestName,
            customer_phone: selectedMember?.phone ?? guestPhone,
            table_number: selectedTable === '' ? null : Number(selectedTable),
            // 🎯 پچ ۵۰-هـ-د: پیام‌های آمادهٔ ردیف‌ها به تفکیک + توضیحات دستی
            note:
              [
                // 🎯 ۵۰-هـ-خ: نشانهٔ ضمیمه بودن در متن سفارش هم می‌آید (برای فیش‌ها)
                supplementFor ? `ضمیمهٔ سفارش #${fmt(supplementFor.order_number)}` : null,
                lines
                  .filter((l) => (l.note ?? '').trim())
                  .map(
                    (l) =>
                      `${l.name}${l.option_name ? ' (' + l.option_name + ')' : ''} ×${fmt(l.quantity)}: ${l.note!.trim()}`
                  )
                  .join('\n'),
                note.trim(),
              ]
                .filter(Boolean)
                .join('\n') || null,
            // 🎯 پچ ۵۰-هـ-خ: سفارش ضمیمه — والد
            parent_order_id: supplementFor?.id ?? null,
            is_test: isTest,
            manual_discount: discountVal,
            // 🎯 پچ ۵۰-هـ-د/و: منبع تخفیف — سرور روی همین مبنا سهمیه را رزرو/آزاد می‌کند
            discount_source: discountSource,
            items: lines.map((l) => ({
              product_id: l.product_id,
              option_id: l.option_id,
              quantity: l.quantity,
              takeaway: l.takeaway,
              // 🎯 پچ ۵۰-هـ-د: پیام آمادهٔ هر ردیف — در فیش آشپزخانه چاپ می‌شود
              line_note: (l.note ?? '').trim() || null,
            })),
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || (editing ? 'ثبت ویرایش ناموفق بود' : 'ثبت سفارش ناموفق بود'))
      } else {
        setDone(data.order?.order_number ?? 0)
        loadTodayStats()
        setEditing(null)
        setSupplementFor(null)
        setLines([])
        setGuestName('')
        setGuestPhone('')
        setSelectedTable('')
        setNote('')
        setDiscount('')
        setDiscountAuto(null)
        clearMember()
        loadOrders()
      }
    } catch {
      setError('خطای ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  // 🎯 پچ ۵۰-هـ-د: تاریخ شمسی + ساعت زنده — مثل «یکشنبه ۱۴۰۵/۰۸/۲۳» و «۱۶:۴۶»
  const nowDate = new Date(nowTs)
  const jalaliDate = new Intl.DateTimeFormat('fa-IR', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(nowDate)
  const clock = new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(nowDate)

  return (
    <div
      className="pos-root"
      ref={rootRef}
      style={posHeight ? { height: posHeight } : undefined}
    >
      {/* 🎯 پچ ۵۰-هـ-د: تاریخ و ساعت زندهٔ تهران + شمارندهٔ امروز — سمت چپ فرم */}
      <div className="pos-title-row">
        <h1 className="pos-root-title">🧾 ثبت سفارش حضوری (POS)</h1>
        <div className="pos-clock-box">
          <span className="pos-clock-date">{jalaliDate}</span>
          <span className="pos-clock-time">{clock}</span>
          {todayStats && (
            <span className="pos-today-badge">
              📊 امروز: {fmt(todayStats.count)} سفارش
            </span>
          )}
        </div>
      </div>
      <p className="pos-root-sub">
        اول مشتری، بعد میز، بعد محصولات — همه‌چیز در یک صفحه.
      </p>

      {/* 🎯 پچ ۵۰-هـ-ز: نوار زندهٔ آشپزخانه + بوق و کیوسک */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={badge('#fdf0e0', '#9a5b1f')}>🔥 در آماده‌سازی: {fmt(livePreparing)}</span>
        <span style={badge('#e5f0e6', '#2d5d3e')}>✅ آمادهٔ تحویل: {fmt(liveReady)}</span>
        <span style={badge('#e8f0f6', '#4a7c9b')}>📱 در انتظار تأیید آنلاین: {fmt(livePendingOnline)}</span>
        <button
          type="button"
          style={smallBtn}
          title={soundOn ? 'بوق سفارش آنلاین روشن است' : 'بوق خاموش'}
          onClick={() => setSoundOn((v) => !v)}
        >
          {soundOn ? '🔔' : '🔕'}
        </button>
        <button
          type="button"
          style={smallBtn}
          title="حالت کیوسک — تمام‌صفحه و بدون منوی ادمین"
          onClick={toggleKiosk}
        >
          🖥️ {kiosk ? 'خروج از کیوسک' : 'کیوسک'}
        </button>
      </div>

      {done !== null && (
        <div style={{ ...card, background: '#e8f1e9', padding: 10, flexShrink: 0 }}>
          ✅ سفارش شمارهٔ <strong>{fmt(done)}</strong> ثبت شد.{' '}
          <a href="/admin/orders" style={{ textDecoration: 'underline' }}>
            رفتن به سفارش‌ها
          </a>
        </div>
      )}
      {/* 🎯 پچ ۵۰-هـ-و: بنر حالت ویرایش */}
      {editing && done === null && (
        <div
          style={{
            ...card,
            background: '#fdf4e3',
            border: '1px solid #e3c98a',
            padding: 10,
            flexShrink: 0,
          }}
        >
          ✏️ در حال ویرایش سفارش شمارهٔ{' '}
          <strong>{fmt(editing.order_number)}</strong> — بعد از تغییرها «ثبت ویرایش» را
          بزن. قیمت‌ها هنگام ثبت، با قیمت روزِ منو دوباره محاسبه می‌شوند.
        </div>
      )}

      {/* ─── 🎯 پچ ۵۰-هـ-خ: بنر «سفارش ضمیمه» — مشتری/میز از سفارش اصلی به ارث می‌رسد ─── */}
      {supplementFor && !editing && (
        <div
          style={{
            ...card,
            background: '#fdf6ec',
            border: '1px dashed #e3c98f',
            padding: 10,
            flexShrink: 0,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6b4f3a' }}>
            🧾 ضمیمهٔ سفارش #{fmt(supplementFor.order_number)}
          </span>
          <span style={{ fontSize: 12, color: '#766f64' }}>
            مبلغ اصلی {fmt(supplementFor.subtotal)}
            {supplementFor.customer_name ? ` · 👤 ${supplementFor.customer_name}` : ''}
            {supplementFor.table_number != null
              ? ` · 🪑 میز ${fmt(supplementFor.table_number)}`
              : ' · 🥡 بیرون‌بر'}
            — فقط اقلام جدید را اضافه کن؛ با ثبت، فاکتور جداگانه‌ای وابسته به همین سفارش می‌شود.
          </span>
          <button
            type="button"
            style={{ ...smallBtn, marginRight: 'auto', flexShrink: 0 }}
            onClick={cancelSupplement}
          >
            ✕ لغو ضمیمه
          </button>
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
            {/* 🎯 پچ ۵۰-هـ-و: سهمیهٔ باقی‌ماندهٔ تخفیف سازمانی — امروز و کل */}
            {(memberInfo?.active?.source === 'org' ||
              memberInfo?.active?.source === 'stacked-org') &&
              memberInfo?.orgRemainingToday != null && (
                <span
                  style={badge(
                    memberInfo.orgRemainingToday === 0 ? '#fde8e6' : '#e5f0e6',
                    memberInfo.orgRemainingToday === 0 ? '#9b3c32' : '#2d5d3e'
                  )}
                  title="سهمیهٔ باقی‌ماندهٔ تخفیف سازمانی (امروز · مجموع)"
                >
                  🎟️ سهمیهٔ تخفیف — امروز:{' '}
                  {fmt(memberInfo.orgRemainingToday)} · کل:{' '}
                  {fmt(memberInfo.orgTotalRemaining ?? 0)}
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
          {/* 🎯 پچ ۵۰-هـ-خ: سوییچ نمای منو — تصویری / متنی فشرده (کنار جستجو) */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'stretch' }}>
            <button
              type="button"
              title="نمای تصویری"
              style={{
                ...smallBtn,
                padding: '0 10px',
                fontSize: 14,
                color: menuView === 'img' ? '#fff' : '#6b4f3a',
                background: menuView === 'img' ? '#6b4f3a' : '#fff',
                borderColor: menuView === 'img' ? '#6b4f3a' : '#e3ddd2',
              }}
              onClick={() => changeMenuView('img')}
            >
              🖼️
            </button>
            <button
              type="button"
              title="نمای متنی فشرده — برای منوی شلوغ"
              style={{
                ...smallBtn,
                padding: '0 10px',
                fontSize: 14,
                color: menuView === 'text' ? '#fff' : '#6b4f3a',
                background: menuView === 'text' ? '#6b4f3a' : '#fff',
                borderColor: menuView === 'text' ? '#6b4f3a' : '#e3ddd2',
              }}
              onClick={() => changeMenuView('text')}
            >
              📝
            </button>
          </div>
        </div>
        {listening && (
          <small
            style={{ color: '#c0392b', fontSize: 11, display: 'block', marginTop: 4 }}
          >
            🎤 در حال شنود… اسم محصول را بگو (فارسی).
          </small>
        )}

          {/* 🎯 پچ ۵۰-هـ-خ: «اقلام پر سفارش» دیگر ردیف جدا نیست — چیپ ثابتِ اول دسته‌ها */}
          <div className="pos-tab-row">
            {featured.length > 0 && (
              <button
                type="button"
                className="pos-tab"
                style={{
                  background: cat === '__featured' ? '#b0722c' : '#fdf6ec',
                  borderColor: '#e3c98f',
                  color: cat === '__featured' ? '#fff' : '#9a5b1f',
                  fontWeight: cat === '__featured' ? 700 : 700,
                }}
                onClick={() => setCat(cat === '__featured' ? 'all' : '__featured')}
              >
                ⭐ اقلام پر سفارش
              </button>
            )}
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

          {/* گرید تایل لمسی — هر تایل با رنگ دستهٔ خودش؛ 🎯 ۵۰-هـ-خ: دو نمای تصویری/متنی */}
          <div className={`pos-menu-grid${menuView === 'text' ? ' pos-grid-text' : ''}`}>
            {shown.map((p) => {
              const opts = optionsOf(p)
              const meta = catMeta(p.category_id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pos-tile"
                  style={
                    menuView === 'text'
                      ? {
                          ...tile,
                          borderRight: '4px solid ' + meta.color,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '9px 10px',
                        }
                      : { ...tile, borderRight: '4px solid ' + meta.color }
                  }
                  onClick={() => (opts.length > 0 ? openVariant(p) : add(p))}
                >
                  {menuView === 'img' ? (
                    // 🎯 پچ ۵۰-هـ-ب: عکس محصول؛ اگر عکس ندارد، آیکون دسته‌اش
                    p.image_url ? (
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
                    )
                  ) : null}
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12.5,
                      lineHeight: 1.3,
                      ...(menuView === 'text'
                        ? {
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                          }
                        : {}),
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: '#6b4f3a',
                      fontWeight: 700,
                      ...(menuView === 'text' ? { flexShrink: 0 } : {}),
                    }}
                  >
                    {opts.length > 0 ? '+ گزینه‌ها' : fmt(p.price)}
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
            <h3 style={{ margin: 0, fontSize: 15 }}>
              {editing
                ? `✏️ ویرایش سفارش #${fmt(editing.order_number)} (${fmt(lines.length)} ردیف)`
                : `🧾 سفارش (${fmt(lines.length)} ردیف)`}
            </h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* 🎯 پچ ۵۰-هـ-و: لیست سفارش‌های امروز — فیلتر حضوری/آنلاین + ویرایش */}
              <button
                type="button"
                style={{ ...smallBtn, fontSize: 12 }}
                title="سفارش‌های امروز — با فیلتر حضوری/آنلاین و امکان ویرایش"
                onClick={openOrders}
              >
                📋 سفارش‌ها
              </button>
              {lines.length > 0 && !editing && (
                <button
                  type="button"
                  style={{ ...smallBtn, fontSize: 12 }}
                  title="پاک کردن همهٔ ردیف‌ها"
                  onClick={() => setLines([])}
                >
                  🧹 پاک کردن
                </button>
              )}
              {editing && (
                <button
                  type="button"
                  style={{ ...smallBtn, fontSize: 12, color: '#9b3c32' }}
                  onClick={cancelEdit}
                >
                  انصراف از ویرایش
                </button>
              )}
            </div>
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
                    {l.note && (
                      <small
                        style={{
                          display: 'block',
                          color: '#b45309',
                          fontWeight: 700,
                          marginTop: 2,
                        }}
                      >
                        📝 {l.note}
                      </small>
                    )}
                  </div>
                  {/* 🎯 پچ ۵۰-هـ-د: پیام آماده برای همین ردیف — کافه و غذا */}
                  <button
                    type="button"
                    title="پیام آماده برای این آیتم"
                    style={{
                      ...smallBtn,
                      padding: '2px 7px',
                      fontSize: 13,
                      background: l.note ? '#e9f3ec' : '#fff',
                      borderColor: l.note ? '#3f7d5c' : '#d9cfc0',
                      flexShrink: 0,
                    }}
                    onClick={() => setNoteFor(k)}
                  >
                    💬
                  </button>
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
                      fontSize: 13.5,
                      flexShrink: 0,
                      minWidth: 74,
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
            {ineligibleBase > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: '#8a5a24',
                }}
              >
                <span>⛔ غیرمشمول تخفیف</span>
                <strong>{fmt(ineligibleBase)}</strong>
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
                  {ineligibleBase > 0 && (
                    <small style={{ fontSize: 10.5, color: '#8a5a24' }}>
                      {' '}
                      — فقط اقلام مشمول
                    </small>
                  )}
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
              {/* 🎯 پچ ۵۰-هـ-و: یادآوری پیام‌های آماده */}
              <small style={{ color: '#a89f8f', fontSize: 11 }}>
                پیام‌های 💬 ردیف‌ها هنگام ثبت، به‌صورت «نام ×تعداد: پیام» به توضیحات
                اضافه می‌شوند و در فیش آشپزخانه زیر همان آیتم چاپ می‌شوند.
              </small>
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
            {busy ? 'در حال ثبت...' : editing ? '💾 ثبت ویرایش سفارش' : 'ثبت سفارش'}
          </button>
        </section>
      </div>

      {/* 🎯 پچ ۵۰-هـ-و: مودال لیست سفارش‌های امروز — فیلتر حضوری/آنلاین + ویرایش */}
      {ordersOpen && (
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
          onClick={() => setOrdersOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              color: '#333',
              borderRadius: 14,
              padding: 16,
              maxWidth: 580,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0 }}>
                📋 {listFrom || listTo ? 'سفارش‌های بازهٔ انتخابی' : 'سفارش‌های امروز'}
                <span style={{ fontSize: 12, color: '#766f64', fontWeight: 400 }}>
                  {' '}
                  ({fmt(listTotal)})
                </span>
                {/* 🎯 پچ ۵۰-هـ-وِی: نمایش بازه به تاریخ شمسی */}
                {(listFrom || listTo) && (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: '#9a6b3f',
                      fontWeight: 400,
                      marginRight: 6,
                    }}
                  >
                    {listFrom ? `از ${formatJalali(listFrom)}` : ''}
                    {listFrom && listTo ? ' ' : ''}
                    {listTo ? `تا ${formatJalali(listTo)}` : listFrom ? ' به بعد' : ''}
                    {!listFrom && listTo ? `تا ${formatJalali(listTo)}` : ''}
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{ ...smallBtn, fontSize: 12 }}
                  onClick={() => loadOrders()}
                >
                  ↻
                </button>
                <button
                  type="button"
                  style={smallBtn}
                  onClick={() => setOrdersOpen(false)}
                >
                  بستن
                </button>
              </div>
            </div>
            {/* 🎯 پچ ۵۰-هـ-او/وِی: فیلتر بازهٔ تاریخ شمسی (از/تا) + بازگشت به امروز */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: '#766f64' }}>📅 از</span>
              <JalaliDateSelect
                value={listFrom}
                onChange={(g) => {
                  setListFrom(g)
                  loadOrders({ page: 1, from: g })
                }}
              />
              <span style={{ fontSize: 12, color: '#766f64' }}>تا</span>
              <JalaliDateSelect
                value={listTo}
                onChange={(g) => {
                  setListTo(g)
                  loadOrders({ page: 1, to: g })
                }}
              />
              <button
                type="button"
                style={{ ...smallBtn, fontSize: 12 }}
                onClick={() => {
                  setListFrom('')
                  setListTo('')
                  loadOrders({ page: 1, from: '', to: '' })
                }}
              >
                امروز
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {(
                [
                  ['all', 'همه'],
                  ['admin', '🏪 حضوری'],
                  ['online', '📱 آنلاین'],
                ] as const
              ).map(([key, label]) => {
                const n =
                  key === 'all'
                    ? ordersList.length
                    : ordersList.filter((o) =>
                        key === 'admin' ? o.source === 'admin' : o.source !== 'admin'
                      ).length
                return (
                  <button
                    key={key}
                    type="button"
                    style={chip(ordersFilter === key)}
                    onClick={() => setOrdersFilter(key)}
                  >
                    {label} ({fmt(n)})
                  </button>
                )
              })}
            </div>
            {ordersErr && (
              <small style={{ display: 'block', color: '#9b3c32', marginBottom: 8 }}>
                {ordersErr}
              </small>
            )}
            {ordersLoading ? (
              <p style={{ color: '#766f64', fontSize: 13, margin: '8px 0' }}>
                ⏳ در حال دریافت سفارش‌ها...
              </p>
            ) : ordersList.filter((o) =>
                ordersFilter === 'all'
                  ? true
                  : ordersFilter === 'admin'
                    ? o.source === 'admin'
                    : o.source !== 'admin'
              ).length === 0 ? (
              <p style={{ color: '#766f64', fontSize: 13, margin: '8px 0' }}>
                امروز در این دسته سفارشی نیست.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  maxHeight: 400,
                  overflowY: 'auto',
                }}
              >
                {ordersList
                  .filter((o) =>
                    ordersFilter === 'all'
                      ? true
                      : ordersFilter === 'admin'
                        ? o.source === 'admin'
                        : o.source !== 'admin'
                  )
                  .map((o) => {
                    const st = settlementOf(o)
                    const anyTakeaway = o.items.some((it) => it.takeaway)
                    const expanded = expandedRowId === o.id
                    // 🎯 ۵۰-هـ-خ: شمارهٔ سفارش والد (برای بج ضمیمه)
                    const parentNum = o.parent_order_id
                      ? ordersList.find((x) => x.id === o.parent_order_id)
                          ?.order_number ?? null
                      : null
                    return (
                    <div
                      key={o.id}
                      style={{
                        border: '1px solid #e7dfd3',
                        borderRadius: 10,
                        padding: '8px 10px',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        // 🐛 فیکس ۵۰-هـ-ح: سرریز افقی — grid-item نباید min-width:auto بماند
                        minWidth: 0,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 13.5 }}>
                            #{fmt(o.order_number)}
                          </strong>
                          {o.is_test && (
                            <span style={{ fontSize: 10, color: '#9a6b3f' }}>🧪 تستی</span>
                          )}
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: o.source === 'admin' ? '#6b4f3a' : '#4a7c9b',
                              background: o.source === 'admin' ? '#f3efe7' : '#e8f0f6',
                              borderRadius: 6,
                              padding: '1px 6px',
                            }}
                          >
                            {o.source === 'admin' ? '🏪 حضوری' : '📱 آنلاین'}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color:
                                POS_STATUS_COLORS[o.status] ?? '#766f64',
                            }}
                          >
                            {POS_STATUS_LABELS[o.status] ?? o.status}
                          </span>
                          {o.table_number != null && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#6b4f3a',
                                background: '#f3efe7',
                                borderRadius: 6,
                                padding: '1px 6px',
                              }}
                            >
                              🪑 میز {fmt(o.table_number)}
                            </span>
                          )}
                          {anyTakeaway && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#9a5b1f',
                                background: '#fdf0e0',
                                borderRadius: 6,
                                padding: '1px 6px',
                              }}
                            >
                              🥡 بیرون‌بر
                            </span>
                          )}
                          {st.state === 'paid' && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#3f7d5c',
                                background: '#e5f0e6',
                                borderRadius: 6,
                                padding: '1px 6px',
                              }}
                            >
                              💳 تسویه شده
                            </span>
                          )}
                          {st.state === 'partial' && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#9a6b3f',
                                background: '#fdf0e0',
                                borderRadius: 6,
                                padding: '1px 6px',
                              }}
                            >
                              💳 مانده {fmt(st.remaining)}
                            </span>
                          )}
                          {parentNum != null && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#6b4f3a',
                                background: '#fdf6ec',
                                border: '1px dashed #e3c98f',
                                borderRadius: 6,
                                padding: '1px 6px',
                              }}
                            >
                              🧾 ضمیمهٔ #{fmt(parentNum)}
                            </span>
                          )}
                          <span dir="ltr" style={{ fontSize: 11, color: '#a89f8f' }}>
                            {new Intl.DateTimeFormat('fa-IR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(o.created_at))}
                          </span>
                        </div>
                        {/* 🎯 ۵۰-هـ-ح: مشتری در خط جدا — همیشه خوانا */}
                        <div style={{ fontSize: 12, color: '#5c554b', marginTop: 3 }}>
                          👤 {o.customer_name || 'مهمان'}
                          {o.customer_phone ? ` — ${o.customer_phone}` : ''}
                        </div>
                        {/* 🎯 ۵۰-هـ-ح: خلاصهٔ اقلام — کلیک = ریز اقلام */}
                        <button
                          type="button"
                          title="نمایش ریز اقلام"
                          onClick={() => setExpandedRowId(expanded ? null : o.id)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'right',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            cursor: 'pointer',
                            color: '#766f64',
                            fontSize: 12,
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {expanded
                            ? '▲ بستن ریز اقلام'
                            : `👁 ${fmt(o.items.length)} آیتم: ${o.items
                                .slice(0, 2)
                                .map((it) => it.product_name)
                                .join('، ')}${
                                o.items.length > 2
                                  ? ` و ${fmt(o.items.length - 2)} مورد دیگر`
                                  : ''
                              } ▼`}
                        </button>
                        {expanded && (
                          <div
                            style={{
                              marginTop: 6,
                              borderTop: '1px dashed #e7dfd3',
                              paddingTop: 6,
                              display: 'grid',
                              gap: 3,
                            }}
                          >
                            {o.items.map((it, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: 12,
                                  color: '#4b443b',
                                  display: 'flex',
                                  gap: 6,
                                  minWidth: 0,
                                }}
                              >
                                <strong style={{ minWidth: 38, textAlign: 'center' }}>
                                  {fmt(it.quantity)}×
                                </strong>
                                <span style={{ minWidth: 0 }}>
                                  {it.product_name}
                                  {it.option_name ? ` (${it.option_name})` : ''}
                                  {it.takeaway ? ' · 🥡' : ''}
                                  {it.line_note && (
                                    <em
                                      style={{
                                        color: '#9a6b3f',
                                        fontStyle: 'normal',
                                      }}
                                    >
                                      {' '}
                                      — 💬 {it.line_note}
                                    </em>
                                  )}
                                </span>
                              </div>
                            ))}
                            {o.note && (
                              <div style={{ fontSize: 11.5, color: '#766f64' }}>
                                📝 {o.note}
                              </div>
                            )}
                            {/* 🎯 ۵۰-هـ-خ: پرداخت‌های یکجای زنجیره (اصلی + ضمیمه‌ها) */}
                            {(() => {
                              const kids = ordersList.filter(
                                (x) => x.parent_order_id === o.id
                              )
                              const chain = [o, ...kids]
                              const chainSubtotal = chain.reduce(
                                (s, x) => s + Math.round(Number(x.subtotal) || 0),
                                0
                              )
                              const chainPaid = chain.reduce(
                                (s, x) => s + settlementOf(x).paid,
                                0
                              )
                              const chainRemaining = Math.max(
                                0,
                                chainSubtotal - chainPaid
                              )
                              const chainPays = chain.flatMap((x) =>
                                confirmedPayments(x)
                              )
                              const kidNums = kids
                                .map((k) => `#${fmt(k.order_number)}`)
                                .join(' و ')
                              return (
                                <div
                                  style={{
                                    borderTop: '1px dashed #e7dfd3',
                                    paddingTop: 6,
                                    marginTop: 6,
                                    display: 'grid',
                                    gap: 4,
                                    fontSize: 11.5,
                                    color: '#5c554b',
                                  }}
                                >
                                  {kids.length > 0 && (
                                    <div
                                      style={{
                                        color: '#6b4f3a',
                                        fontWeight: 700,
                                      }}
                                    >
                                      🧾 ضمیمه‌ها: {kidNums}
                                    </div>
                                  )}
                                  {chainPays.length > 0 ? (
                                    <div>
                                      💳 پرداخت‌ها:{' '}
                                      {chainPays
                                        .map(
                                          (p) =>
                                            `${paymentMethodLabel(p.method)} ${fmt(p.amount)}`
                                        )
                                        .join(' + ')}
                                    </div>
                                  ) : (
                                    <div style={{ color: '#9a6b3f' }}>
                                      💳 هنوز پرداختی ثبت نشده
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      color:
                                        chainRemaining > 0 ? '#9a6b3f' : '#3f7d5c',
                                    }}
                                  >
                                    جمع فاکتورها: {fmt(chainSubtotal)} · مانده:{' '}
                                    {fmt(chainRemaining)}
                                    {kids.length > 0
                                      ? ` (${kids.length + 1} فاکتور)`
                                      : ''}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {fmt(o.subtotal)}
                        </div>
                        {(o.coupon_discount ?? 0) > 0 && (
                          <div style={{ fontSize: 10.5, color: '#b45309' }}>
                            🏷️ −{fmt(o.coupon_discount ?? 0)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          title="سفارش ضمیمه — اقلام جدید وابسته به همین فاکتور"
                          disabled={o.status === 'cancelled'}
                          onClick={() => startSupplement(o)}
                          style={{
                            ...smallBtn,
                            fontSize: 13,
                            padding: '6px 8px',
                            opacity: o.status === 'cancelled' ? 0.45 : 1,
                            cursor:
                              o.status === 'cancelled' ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          title="چاپ فیش (آشپزخانه / سالن / مشتری)"
                          onClick={() => openPrint(o)}
                          style={{ ...smallBtn, fontSize: 13, padding: '6px 8px' }}
                        >
                          🖨️
                        </button>
                        <button
                          type="button"
                          title="تکرار این سفارش در سبد جدید"
                          onClick={() => {
                            setOrdersOpen(false)
                            startEdit(o, true)
                          }}
                          style={{ ...smallBtn, fontSize: 13, padding: '6px 8px' }}
                        >
                          🔁
                        </button>
                        {/* 🎯 پچ ۵۰-هـ-وِی: دکمهٔ پرداخت مستقیم روی ردیف — مودال
                            پرداخت با همهٔ روش‌ها (تک‌روشی یا ترکیبی) */}
                        <button
                          type="button"
                          title="پرداخت / تسویه — تک‌روشی یا ترکیبی 🧩"
                          onClick={() => setPayModalOrder(o)}
                          style={{ ...smallBtn, flexShrink: 0, fontSize: 13, padding: '6px 8px' }}
                        >
                          💳
                        </button>
                        <button
                          type="button"
                          disabled={!isOrderEditable(o)}
                          title={editBlockReason(o)}
                          onClick={() => startEdit(o)}
                          style={{
                            ...smallBtn,
                            flexShrink: 0,
                            fontSize: 13,
                            padding: '6px 8px',
                            opacity: isOrderEditable(o) ? 1 : 0.45,
                            cursor: isOrderEditable(o) ? 'pointer' : 'not-allowed',
                          }}
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                    )
                  })}
              </div>
            )}

            {/* 🎯 پچ ۵۰-هـ-او: صفحه‌بندی لیست — قبلی/بعدی + شمارهٔ صفحهٔ قابل انتخاب */}
            <div style={{ marginTop: 10 }}>
              <div style={{ textAlign: 'center', fontSize: 11.5, color: '#766f64' }}>
                مجموع: {fmt(listTotal)} سفارش · صفحهٔ {fmt(listPage)} از {fmt(listPages)}
              </div>
              {listPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    justifyContent: 'center',
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    style={{ ...smallBtn, opacity: listPage <= 1 ? 0.45 : 1 }}
                    disabled={listPage <= 1 || ordersLoading}
                    onClick={() => loadOrders({ page: listPage - 1 })}
                  >
                    صفحهٔ قبل
                  </button>
                  {pageWindow(listPage, listPages).map((p, i) =>
                    p === '…' ? (
                      <span
                        key={`dots-${i}`}
                        style={{ alignSelf: 'center', color: '#766f64', fontSize: 12 }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        style={{
                          ...smallBtn,
                          ...(p === listPage
                            ? { background: '#6b4f3a', color: '#fff' }
                            : {}),
                        }}
                        disabled={ordersLoading}
                        onClick={() => loadOrders({ page: p })}
                      >
                        {fmt(p)}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    style={{ ...smallBtn, opacity: listPage >= listPages ? 0.45 : 1 }}
                    disabled={listPage >= listPages || ordersLoading}
                    onClick={() => loadOrders({ page: listPage + 1 })}
                  >
                    صفحهٔ بعد
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🎯 پچ ۵۰-هـ-وِی: مودال پرداخت سفارش — تک‌روشی یا ترکیبی 🧩 */}
      {payModalOrder &&
        (() => {
          const kids = ordersList.filter(
            (x) => x.parent_order_id === payModalOrder.id
          )
          const chain = [payModalOrder, ...kids]
          const chainSubtotal = chain.reduce(
            (s, x) => s + Math.round(Number(x.subtotal) || 0),
            0
          )
          const chainPaid = chain.reduce((s, x) => s + settlementOf(x).paid, 0)
          const chainRemaining = Math.max(0, chainSubtotal - chainPaid)
          return (
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
              onClick={() => setPayModalOrder(null)}
            >
              <div
                style={{
                  background: '#fff',
                  color: '#333',
                  borderRadius: 14,
                  padding: 16,
                  maxWidth: 560,
                  width: '100%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    💳 پرداخت سفارش #{fmt(payModalOrder.order_number)}
                  </h3>
                  <button
                    type="button"
                    style={smallBtn}
                    onClick={() => setPayModalOrder(null)}
                  >
                    ✕
                  </button>
                </div>
                {kids.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b4f3a',
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    🧾 با ضمیمه‌ها:{' '}
                    {kids.map((k) => `#${fmt(k.order_number)}`).join(' و ')}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 12.5,
                    color: '#5c554b',
                    marginBottom: 10,
                  }}
                >
                  جمع فاکتورها: {fmt(chainSubtotal)} · مانده:{' '}
                  <b>{fmt(chainRemaining)}</b>
                </div>
                <AdminSplitPayment
                  orderId={payModalOrder.id}
                  remaining={chainRemaining}
                  onDone={() => {
                    setPayModalOrder(null)
                    loadOrders()
                  }}
                  onCancel={() => setPayModalOrder(null)}
                />
              </div>
            </div>
          )
        })()}

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

      {/* 🎯 پچ ۵۰-هـ-د: انتخاب پیام آماده برای ردیف سبد — کافه و غذا */}
      {noteFor && (
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
          onClick={() => setNoteFor(null)}
        >
          <div
            style={{
              background: '#fff',
              color: '#333',
              borderRadius: 14,
              padding: 16,
              maxWidth: 380,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 10px' }}>
              💬 پیام آماده — {lines.find((l) => lineKey(l) === noteFor)?.name ?? ''}
            </h3>
            {quickNotes.length === 0 && (
              <p style={{ color: '#766f64', fontSize: 13, margin: '0 0 10px' }}>
                هنوز پیام آماده‌ای نساخته‌ای — اولین را همین‌جا اضافه کن (مثلاً «بدون شکر»،
                «اسپرسو دبل»، «کم نمک»).
              </p>
            )}
            <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {quickNotes.map((n) => (
                <div key={n} style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'right',
                      padding: '8px 12px',
                      border: '1px solid #e3ddd2',
                      borderRadius: 10,
                      background: '#fdf6ec',
                      color: '#6b4f3a',
                      font: 'inherit',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => setLineNote(noteFor, n)}
                  >
                    ➕ {n}
                  </button>
                  <button
                    type="button"
                    title="حذف از پیام‌های آماده"
                    style={{ ...smallBtn, padding: '4px 10px', flexShrink: 0 }}
                    onClick={() => delQuickNote(n)}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input
                style={input}
                placeholder="پیام آمادهٔ جدید…"
                value={newQuick}
                onChange={(e) => setNewQuick(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addQuickNote()
                  }
                }}
              />
              <button
                type="button"
                style={{ ...smallBtn, flexShrink: 0, fontWeight: 700 }}
                onClick={addQuickNote}
              >
                {quickBusy ? '...' : '+ افزودن'}
              </button>
            </div>
            <div
              style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-start' }}
            >
              <button
                type="button"
                style={{ ...smallBtn, color: '#9b3c32' }}
                onClick={() => setLineNote(noteFor, '')}
              >
                پاک کردن پیام این ردیف
              </button>
              <button type="button" style={smallBtn} onClick={() => setNoteFor(null)}>
                بستن
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

            {/* 🎯 پچ ۵۰-هـ-د: ارسال لینک با پیامک — تا پیامک تنظیم نشود و شماره معتبر نباشد، خاموش */}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                disabled={smsBusy || !smsOk || !invitePhoneOk}
                title={
                  !smsOk
                    ? 'اول کلید پیامک را در تنظیمات ادمین وارد کنید'
                    : !invitePhoneOk
                      ? 'شمارهٔ موبایل مهمان را در ردیف مشتری وارد کنید'
                      : 'ارسال لینک ثبت‌نام با پیامک'
                }
                onClick={sendInviteSms}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #e3ddd2',
                  borderRadius: 10,
                  background: smsOk && invitePhoneOk ? '#2d5d3e' : '#efece6',
                  color: smsOk && invitePhoneOk ? '#fff' : '#9a927f',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: smsOk && invitePhoneOk ? 'pointer' : 'not-allowed',
                }}
              >
                {smsBusy ? '⏳ در حال ارسال...' : '📨 ارسال لینک با پیامک'}
              </button>
              {smsMsg && (
                <small
                  style={{
                    display: 'block',
                    marginTop: 6,
                    fontSize: 12,
                    color: smsMsg.ok ? '#2d5d3e' : '#9b3c32',
                  }}
                >
                  {smsMsg.text}
                </small>
              )}
              {!smsOk && (
                <small
                  style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#8a5a24' }}
                >
                  پیامک تنظیم نشده — کلید کاوه‌نگار را در تنظیمات ادمین وارد کنید.
                </small>
              )}
              {!invitePhoneOk && smsOk && (
                <small
                  style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#8a5a24' }}
                >
                  شمارهٔ موبایل مهمان را در کادر بالای فرم وارد کنید.
                </small>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 🎯 پچ ۵۰-هـ-ز: مودال انتخاب مقصد چاپ */}
      {printing && (
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
          onClick={() => setPrinting(null)}
        >
          <div
            style={{
              background: '#fff',
              color: '#333',
              borderRadius: 14,
              padding: 16,
              maxWidth: 420,
              width: '100%',
              display: 'grid',
              gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0 }}>🖨️ چاپ سفارش #{fmt(printing.order_number)}</h3>
            <p style={{ margin: 0, fontSize: 12.5, color: '#766f64' }}>
              👤 {printing.customer_name || 'مهمان'}
              {printing.customer_phone ? ` — ${printing.customer_phone}` : ''}
              {printing.table_number != null
                ? ` · 🪑 میز ${fmt(printing.table_number)}`
                : printing.items.some((it) => it.takeaway)
                  ? ' · 🥡 بیرون‌بر'
                  : ''}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: '#766f64' }}>
              کدام فیش را چاپ می‌کنی؟ (چاپگرها بعداً در تنظیمات به هر بخش وصل می‌شوند)
            </p>
            {(
              [
                ['kitchen', '🧑‍🍳 فیش آشپزخانه', 'فقط آیتم‌ها و پیام‌ها — بدون قیمت'],
                ['hall', '🍽️ فیش سالن', 'آیتم‌ها + میز + وضعیت تسویه — بدون قیمت'],
                ['customer', '🧾 فاکتور مشتری', 'لوگو + تسویه + عضویت/گرید + جدول اقلام'],
              ] as const
            ).map(([key, title, sub]) => (
              <button
                key={key}
                type="button"
                style={{
                  font: 'inherit',
                  textAlign: 'right',
                  border: '1px solid #e7dfd3',
                  borderRadius: 10,
                  padding: '9px 12px',
                  background: '#faf6ef',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setPrintJob({ order: printing, target: key, extra: printExtra })
                  setPrinting(null)
                }}
              >
                <strong>{title}</strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#766f64' }}>
                  {sub}
                </span>
              </button>
            ))}
            <button type="button" style={smallBtn} onClick={() => setPrinting(null)}>
              بستن
            </button>
          </div>
        </div>
      )}

      {/* 🎯 پچ ۵۰-هـ-ح: فیش‌های چاپی — portal به body با الگوی .print-invoice */}
      {printJob &&
        createPortal(
          (() => {
            const o = printJob.order
            const st = settlementOf(o)
            const pays = confirmedPayments(o)
            const feeTotal = o.items.reduce(
              (s, it) => s + (it.takeaway ? Number(it.takeaway_fee) || 0 : 0),
              0
            )
            // 🐛 فیکس ۵۰-هـ-خ: روی سفارش POS، coupon_discount و manual_discount همان یک
            // مبلغ‌اند (برچسب منبع در coupon_code) — تخفیف فقط یک‌بار شمرده شود
            const discountTotal =
              Number(o.coupon_discount) || Number(o.manual_discount) || 0
            const gross =
              Math.round(Number(o.subtotal) || 0) + discountTotal - feeTotal
            const discountLabel =
              o.coupon_code === 'MEMBERSHIP'
                ? 'تخفیف باشگاه/سازمان'
                : o.coupon_code === 'SUBSCRIPTION'
                  ? 'تخفیف اشتراک'
                  : o.coupon_code === 'GRADE'
                    ? 'تخفیف گرید'
                    : o.coupon_code
                      ? `کد تخفیف (${o.coupon_code})`
                      : 'تخفیف دستی'
            // 🎯 ۵۰-هـ-خ: سفارش ضمیمه — شمارهٔ والد برای فیش‌ها
            const parentNum = o.parent_order_id
              ? ordersList.find((x) => x.id === o.parent_order_id)?.order_number ??
                null
              : null
            const itemCount = o.items.reduce((s, it) => s + it.quantity, 0)
            // 🐛 فیکس ۵۰-هـ-ر: روش پرداخت فقط وقتی نمایش داده شود که پرداخت واقعی
            // وجود دارد — سفارش POSِ بازِ تسویه‌نشده payment_method پیش‌فرض «نقدی»
            // دارد و نباید روی فاکتور مشتری/سالن به‌عنوان پرداخت‌شده دیده شود
            const payLine =
              pays.length > 0
                ? pays
                    .map((p) => `${paymentMethodLabel(p.method)} ${fmt(p.amount)}`)
                    .join(' + ')
                : st.state === 'paid' && o.payment_method
                  ? paymentMethodLabel(o.payment_method)
                  : null
            const settleText =
              st.state === 'paid'
                ? '✅ تسویه شده'
                : st.state === 'partial'
                  ? `💳 ترکیبی — پرداخت‌شده: ${fmt(st.paid)} · مانده: ${fmt(st.remaining)}`
                  : `⏳ تسویه نشده — مانده: ${fmt(st.remaining)}`
            const fullDate = new Intl.DateTimeFormat('fa-IR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(o.created_at))
            const isKitchen = printJob.target === 'kitchen'
            const isHall = printJob.target === 'hall'
            const isCustomer = !isKitchen && !isHall
            const extra = printJob.extra ?? null
            const cellBorder = '1px solid #444'
            const th: CSSProperties = {
              border: cellBorder,
              padding: '5px 10px',
              fontSize: 12,
              background: '#f2f2f2',
              whiteSpace: 'nowrap',
            }
            const td: CSSProperties = {
              border: cellBorder,
              padding: '5px 10px',
              fontSize: 12.5,
            }
            return (
              <div
                className="print-invoice"
                id="pos-print-area"
                style={{ display: 'none' }}
              >
                {/* ─── سربرگ ─── */}
                <div
                  style={{
                    textAlign: 'center',
                    borderBottom: '2px solid #222',
                    paddingBottom: 10,
                    marginBottom: 10,
                  }}
                >
                  {logoUrl && isCustomer && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      style={{
                        maxHeight: 62,
                        maxWidth: 200,
                        objectFit: 'contain',
                        margin: '0 auto 6px',
                      }}
                    />
                  )}
                  <div style={{ fontSize: 21, fontWeight: 800 }}>
                    {cafeName || 'کافه پارک'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                    {isKitchen
                      ? '🧑‍🍳 فیش آشپزخانه'
                      : isHall
                        ? '🍽️ فیش سالن'
                        : parentNum != null
                          ? `🧾 فاکتور ضمیمهٔ سفارش #${fmt(parentNum)}`
                          : '🧾 فاکتور فروش'}
                  </div>
                </div>

                {/* ─── مشخصات سفارش ─── */}
                <div
                  style={{
                    fontSize: 12.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '3px 16px',
                    marginBottom: 10,
                    justifyContent: 'center',
                  }}
                >
                  <span>
                    سفارش: <strong>#{fmt(o.order_number)}</strong>
                  </span>
                  {parentNum != null && (
                    <span>
                      🧾 ضمیمهٔ سفارش:{' '}
                      <strong>#{fmt(parentNum)}</strong>
                    </span>
                  )}
                  <span>📅 {fullDate}</span>
                  <span>وضعیت: {POS_STATUS_LABELS[o.status] ?? o.status}</span>
                  {o.table_number != null ? (
                    <span>
                      🪑 میز:{' '}
                      <strong style={{ fontSize: isHall ? 15 : 12.5 }}>
                        {fmt(o.table_number)}
                      </strong>
                    </span>
                  ) : o.items.some((it) => it.takeaway) ? (
                    <span>🥡 بیرون‌بر</span>
                  ) : null}
                  {isHall && <span>👤 {o.customer_name || 'مهمان'}</span>}
                </div>

                {/* 🧾 فاکتور مشتری — جعبهٔ اطلاعات */}
                {isCustomer && (
                  <table
                    style={{
                      width: 'fit-content',
                      maxWidth: '100%',
                      margin: '0 auto 10px',
                      borderCollapse: 'collapse',
                    }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}>
                          مشتری
                        </td>
                        <td style={td}>
                          {o.customer_name || 'مهمان'}
                          {o.customer_phone ? ` — ${o.customer_phone}` : ''}
                        </td>
                      </tr>
                      {parentNum != null && (
                        <tr>
                          <td
                            style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}
                          >
                            سفارش اصلی
                          </td>
                          <td style={td}>#{fmt(parentNum)}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}>
                          عنوان
                        </td>
                        <td style={td}>
                          {extra?.title ?? 'مشتری عادی'}
                          {extra?.gradeName ? ` · گرید: ${extra.gradeName}` : ''}
                        </td>
                      </tr>
                      {extra?.activeLabel && (
                        <tr>
                          <td
                            style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}
                          >
                            تخفیف فعال
                          </td>
                          <td style={td}>{extra.activeLabel}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}>
                          نوع سفارش
                        </td>
                        <td style={td}>
                          {o.source === 'admin'
                            ? 'حضوری (ثبت در صندوق)'
                            : 'آنلاین'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}>
                          تسویه
                        </td>
                        <td style={td}>{settleText}</td>
                      </tr>
                      {payLine && (
                        <tr>
                          <td
                            style={{ ...td, fontWeight: 700, background: '#f7f7f7' }}
                          >
                            نحوهٔ پرداخت
                          </td>
                          <td style={td}>{payLine}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* ─── اقلام ─── */}
                {isKitchen || isHall ? (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: isKitchen ? 15 : 13,
                    }}
                  >
                    <tbody>
                      {o.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px dashed #bbb' }}>
                          <td
                            style={{
                              padding: '5px 2px',
                              whiteSpace: 'nowrap',
                              width: 46,
                            }}
                          >
                            <strong style={{ fontSize: isKitchen ? 18 : 15 }}>
                              {fmt(it.quantity)}
                            </strong>{' '}
                            ×
                          </td>
                          <td style={{ padding: '5px 2px' }}>
                            <strong>{it.product_name}</strong>
                            {it.option_name && <span> ({it.option_name})</span>}
                            {it.takeaway && <span> · 🥡</span>}
                            {it.line_note && (
                              <div
                                style={{
                                  fontSize: isKitchen ? 14 : 12,
                                  fontWeight: 700,
                                  marginTop: 2,
                                }}
                              >
                                💬 {it.line_note}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table
                    style={{
                      width: 'fit-content',
                      maxWidth: '100%',
                      margin: '0 auto',
                      borderCollapse: 'collapse',
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 30 }}>#</th>
                        <th style={{ ...th, textAlign: 'right' }}>شرح</th>
                        <th style={th}>تعداد</th>
                        <th style={th}>مبلغ (تومان)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ ...td, textAlign: 'center' }}>
                            {fmt(idx + 1)}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <strong>{it.product_name}</strong>
                            {it.option_name && <span> ({it.option_name})</span>}
                            {it.takeaway && <span> · 🥡</span>}
                            {it.line_note && (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 10.5,
                                  color: '#555',
                                }}
                              >
                                💬 {it.line_note}
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {fmt(it.quantity)}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: 'left',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {fmt((Number(it.unit_price) || 0) * it.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ─── جمع‌ها ─── */}
                {isCustomer ? (
                  <div
                    style={{
                      width: 'fit-content',
                      maxWidth: '100%',
                      minWidth: 300,
                      margin: '10px auto 0',
                      fontSize: 12.5,
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 24,
                      }}
                    >
                      <span>جمع اقلام ({fmt(itemCount)} عدد)</span>
                      <strong>{fmt(gross)}</strong>
                    </div>
                    {feeTotal > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 24,
                        }}
                      >
                        <span>هزینهٔ بیرون‌بر (ظرف)</span>
                        <strong>{fmt(feeTotal)}</strong>
                      </div>
                    )}
                    {discountTotal > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 24,
                        }}
                      >
                        <span>{discountLabel}</span>
                        <strong>−{fmt(discountTotal)}</strong>
                      </div>
                    )}
                    <div
                      style={{
                        borderTop: '2px solid #222',
                        marginTop: 4,
                        paddingTop: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 24,
                        fontSize: 15,
                      }}
                    >
                      <span>قابل پرداخت</span>
                      <strong>{fmt(o.subtotal)}</strong>
                    </div>
                    {st.paid > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 24,
                          color: '#2d5d3e',
                        }}
                      >
                        <span>پرداخت‌شده</span>
                        <strong>{fmt(st.paid)}</strong>
                      </div>
                    )}
                    {st.remaining > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 24,
                          color: '#9b3c32',
                        }}
                      >
                        <span>مانده</span>
                        <strong>{fmt(st.remaining)}</strong>
                      </div>
                    )}
                  </div>
                ) : isHall ? (
                  <div
                    style={{
                      borderTop: '2px solid #222',
                      marginTop: 10,
                      paddingTop: 8,
                      fontSize: 13,
                      textAlign: 'center',
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    <div>
                      <strong>{settleText}</strong>
                    </div>
                    {payLine && (
                      <div style={{ fontSize: 11.5, color: '#444' }}>
                        روش پرداخت: {payLine}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#666' }}>
                      جمعاً {fmt(itemCount)} عدد اقلام — فیش سالن بدون قیمت
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      borderTop: '1px dashed #999',
                      marginTop: 10,
                      paddingTop: 6,
                      fontSize: 11,
                      textAlign: 'center',
                      color: '#666',
                    }}
                  >
                    جمعاً {fmt(itemCount)} عدد اقلام
                  </div>
                )}

                {/* ─── امضا/تشکر ─── */}
                {!isKitchen && (
                  <div
                    style={{
                      marginTop: 14,
                      textAlign: 'center',
                      fontSize: 11.5,
                      color: '#444',
                    }}
                  >
                    {isHall
                      ? 'سفارش شما در راه است ☕'
                      : 'با تشکر از انتخاب شما ☕'}
                  </div>
                )}
              </div>
            )
          })(),
          document.body
        )}
    </div>
  )
}
