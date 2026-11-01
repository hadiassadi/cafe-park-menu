'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Category, Product } from '@/lib/menu-types'

const LEGACY_GROUP = 'بیرون بر'

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

export default function NewOrderClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [lines, setLines] = useState<Line[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [table, setTable] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<number | null>(null)

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
  const total = base + fees

  async function submit() {
    setError('')
    if (lines.length === 0) return setError('هیچ آیتمی انتخاب نشده است')
    setBusy(true)
    try {
      const res = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          table_number: table.trim() === '' ? null : Number(table),
          note,
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
        setTable('')
        setNote('')
      }
    } catch {
      setError('خطای ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>ثبت سفارش حضوری</h1>

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
        {/* منو */}
        <section style={card}>
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

          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {shown.map((p) => {
              const opts = optionsOf(p)
              return (
                <div
                  key={p.id}
                  style={{ padding: '10px 0', borderBottom: '1px dashed #e7dfd3' }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {opts.length === 0 ? (
                      <button type="button" style={smallBtn} onClick={() => add(p)}>
                        + {fmt(p.price)}
                      </button>
                    ) : (
                      opts.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          style={smallBtn}
                          onClick={() => add(p, o)}
                        >
                          + {o.name} ({fmt(o.price_modifier)})
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
            {!loading && shown.length === 0 && <p>محصولی پیدا نشد.</p>}
          </div>
        </section>

        {/* سبد */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
              <span>قابل پرداخت</span>
              <strong>{fmt(total)} تومان</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <input style={input} placeholder="شمارهٔ میز (اختیاری)" inputMode="numeric" value={table} onChange={(e) => setTable(e.target.value)} />
            <input style={input} placeholder="نام مشتری (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={input} placeholder="شمارهٔ تماس (اختیاری)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <textarea style={{ ...input, minHeight: 60 }} placeholder="توضیحات (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
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
    </div>
  )
}