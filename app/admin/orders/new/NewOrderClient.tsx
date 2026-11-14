'use client'

import { useEffect, useMemo, useState } from 'react'
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

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e7dfd3',
  borderRadius: 12,
  padding: 14,
}
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
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
// 🎯 پچ ۵۰-د: تایل بزرگ لمسی برای گرید محصولات
const tile: React.CSSProperties = {
  border: '1px solid #e7dfd3',
  background: '#fff',
  borderRadius: 10,
  padding: '12px 8px',
  minHeight: 76,
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
  padding: '6px 14px',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: active ? 700 : 400,
})

export default function NewOrderClient({ tables }: { tables: PosTable[] }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [lines, setLines] = useState<Line[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
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

  useEffect(() => {
    fetch('/api/menu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories ?? [])
        setProducts(d.products ?? [])
      })
      .catch(() => setLoadError('بارگذاری منو ناموفق بود'))
      .finally(() => setLoading(false))
  }, [])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        p.is_available !== false &&
        (cat === 'all' || p.category_id === cat) &&
        (!q || p.name.toLowerCase().includes(q))
    )
  }, [products, search, cat])

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
          customer_name: name,
          customer_phone: phone,
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
        setLines([])
        setName('')
        setPhone('')
        setNote('')
        setDiscount('')
      }
    } catch {
      setError('خطای ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>🧾 ثبت سفارش حضوری (POS)</h1>
      <p style={{ color: '#766f64', marginTop: -6 }}>
        میز را بزن، محصولات را لمس کن، سفارش ثبت شود.
      </p>

      {done !== null && (
        <div style={{ ...card, background: '#e8f1e9', marginBottom: 12 }}>
          ✅ سفارش شمارهٔ <strong>{fmt(done)}</strong> ثبت شد.{' '}
          <a href="/admin/orders" style={{ textDecoration: 'underline' }}>
            رفتن به سفارش‌ها
          </a>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ─── منو (گرید لمسی) ─── */}
        <section style={card}>
          {/* انتخاب میز */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: '#766f64', marginBottom: 6 }}>
              میز:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
            </div>
            {tables.length === 0 && (
              <p style={{ color: '#766f64', fontSize: 13, margin: '4px 0 0' }}>
                هنوز میزی در «مدیریت میزها» نساخته‌ای — می‌توانی بدون میز هم
                ثبت کنی.
              </p>
            )}
          </div>

          <input
            style={input}
            placeholder="جستجوی محصول..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
            <button
              type="button"
              style={{ ...smallBtn, background: cat === 'all' ? '#6b4f3a' : '#fff', color: cat === 'all' ? '#fff' : 'inherit' }}
              onClick={() => setCat('all')}
            >
              همه
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                style={{ ...smallBtn, background: cat === c.id ? '#6b4f3a' : '#fff', color: cat === c.id ? '#fff' : 'inherit' }}
                onClick={() => setCat(c.id)}
              >
                {c.icon ? c.icon + ' ' : ''}
                {c.name}
              </button>
            ))}
          </div>

          {loading && <p>در حال بارگذاری...</p>}
          {loadError && <p className="danger">{loadError}</p>}

          {/* 🎯 پچ ۵۰-د: گرید تایل لمسی به‌جای فهرست ردیفی */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
              gap: 8,
              maxHeight: '58vh',
              overflowY: 'auto',
              paddingTop: 4,
            }}
          >
            {shown.map((p) => {
              const opts = optionsOf(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  style={tile}
                  onClick={() => (opts.length > 0 ? openVariant(p) : add(p))}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b4f3a', fontWeight: 700 }}>
                    {opts.length > 0 ? 'انتخاب گزینه…' : fmt(p.price) + ' تومان'}
                  </span>
                </button>
              )
            })}
            {!loading && shown.length === 0 && <p>محصولی پیدا نشد.</p>}
          </div>
        </section>

        {/* ─── سبد ─── */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>🧾 سفارش ({fmt(lines.length)} ردیف)</h3>

          {lines.length === 0 && <p style={{ color: '#766f64' }}>سبد خالی است.</p>}

          {lines.map((l) => {
            const k = lineKey(l)
            return (
              <div
                key={k}
                style={{ padding: '8px 0', borderBottom: '1px dashed #e7dfd3' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>
                    <strong>{l.name}</strong>
                    {l.option_name && <small> ({l.option_name})</small>}
                    {l.takeaway && l.fee ? (
                      <small style={{ color: '#b45309', fontWeight: 700 }}>
                        {' '}
                        🥡 بیرون‌بر (+{fmt(l.fee * l.quantity)})
                      </small>
                    ) : null}
                  </span>
                  <strong>{fmt(l.unit_price * l.quantity)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <button type="button" style={smallBtn} onClick={() => changeQty(k, 1)}>+</button>
                  <span style={{ minWidth: 24, textAlign: 'center' }}>{fmt(l.quantity)}</span>
                  <button type="button" style={smallBtn} onClick={() => changeQty(k, -1)}>−</button>
                  {l.fee ? (
                    <button
                      type="button"
                      style={{ ...smallBtn, background: l.takeaway ? '#fdf0dc' : '#fff' }}
                      onClick={() => toggleTakeaway(k)}
                    >
                      🥡 بیرون‌بر (+{fmt(l.fee)})
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}

          <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>جمع اقلام</span>
              <strong>{fmt(base)} تومان</strong>
            </div>
            {fees > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🥡 هزینهٔ بیرون‌بر</span>
                <strong>{fmt(fees)} تومان</strong>
              </div>
            )}
            {/* 🎯 پچ ۵۰-د: تخفیف دستی */}
            {discountVal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                <span>تخفیف دستی</span>
                <strong>−{fmt(discountVal)} تومان</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
              <span>قابل پرداخت</span>
              <strong>{fmt(total)} تومان</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <input
              style={input}
              placeholder="تخفیف دستی (تومان) — اختیاری"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(normalizeDigits(e.target.value))}
            />
            <input style={input} placeholder="نام مشتری (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={input} placeholder="شمارهٔ تماس (اختیاری)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <textarea style={{ ...input, minHeight: 60 }} placeholder="توضیحات (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
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
              <span>
                🧪 سفارش آزمایشی (در گزارش‌ها حساب نشود)
              </span>
            </label>
          </div>

          {error && <p className="danger" style={{ marginTop: 10 }}>{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy || lines.length === 0}
            style={{
              marginTop: 12,
              width: '100%',
              padding: 14,
              border: 0,
              borderRadius: 12,
              background: '#6b4f3a',
              color: '#fff',
              font: 'inherit',
              fontWeight: 700,
              cursor: busy || lines.length === 0 ? 'not-allowed' : 'pointer',
              opacity: busy || lines.length === 0 ? 0.6 : 1,
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
    </div>
  )
}
