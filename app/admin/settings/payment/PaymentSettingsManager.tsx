'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getPaymentSettings,
  updatePaymentSettings,
  listPaymentInstruments,
  listAdminUsers,
  createCashRegister,
  updateCashRegister,
  createPosDevice,
  updatePosDevice,
  type PaymentInstrument,
  type AdminUserOption,
  type PaymentSettings,
} from './actions'

const GATEWAY_OPTIONS = [
  { value: 'zarinpal', label: 'زرین‌پال', icon: '💳' },
  { value: 'idpay', label: 'آیدی‌پی', icon: '💳' },
  { value: 'nextpay', label: 'نکست‌پی', icon: '💳' },
]

// ─── 🎯 پچ ۵۰-و-الف/ب: مدیریت صندوق‌های نقدی و حساب‌های بانکی ───

function OwnerSelect({
  users,
  value,
  onChange,
}: {
  users: AdminUserOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="field">
      <label>مالک صندوق</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">مشترک — همهٔ اپراتورها</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.email ? ` (${u.email})` : ''}
          </option>
        ))}
      </select>
      <small>
        در تسویهٔ نقدی، صندوقِ مالکِ همان اپراتور به‌صورت پیش‌فرض انتخاب می‌شود؛
        صندوق بدون مالک برای همه دیده می‌شود.
      </small>
    </div>
  )
}

function CashRegisterSection() {
  const [items, setItems] = useState<PaymentInstrument[]>([])
  const [users, setUsers] = useState<AdminUserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // افزودن
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [owner, setOwner] = useState('')
  // ویرایش
  const [editId, setEditId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eLocation, setELocation] = useState('')
  const [eOwner, setEOwner] = useState('')

  async function reload() {
    const [res, ures] = await Promise.all([
      listPaymentInstruments(),
      listAdminUsers(),
    ])
    if (res.error) {
      setError(res.error)
    } else {
      setError(null)
      setItems(res.registers ?? [])
    }
    if (ures.users) setUsers(ures.users)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(fn: () => Promise<{ success?: boolean; error?: string }>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    if (res.error) setError(res.error)
    await reload()
    setBusy(false)
  }

  function startEdit(it: PaymentInstrument) {
    setEditId(it.id)
    setEName(it.name)
    setELocation(it.location ?? '')
    setEOwner(it.owner_id ?? '')
  }

  const ownerName = (oid: string | null) =>
    oid ? (users.find((u) => u.id === oid)?.name ?? '—') : 'مشترک'

  return (
    <section className="admin-card payment-section">
      <div className="payment-section-header-static">
        <div className="payment-section-icon">🧰</div>
        <div>
          <h2 className="payment-section-title">صندوق‌های نقدی</h2>
          <p className="payment-section-hint">
            در تسویهٔ نقدی POS انتخاب می‌شود — مجموع صندوق‌ها = موجودی کل نقدی
            (مبنای بستن شیفت و مغایرت‌گیری)
          </p>
        </div>
      </div>

      {loading ? (
        <p className="empty-admin">⏳ در حال بارگذاری...</p>
      ) : (
        <>
          {error && <div className="admin-error">❌ {error}</div>}
          {items.length === 0 && (
            <p className="empty-admin">
              هنوز صندوقی نساخته‌ای — اولین را اضافه کن (برای هر اپراتور می‌توانی
              صندوق جداگانه با مالک بسازی).
            </p>
          )}
          {items.map((it) => (
            <div key={it.id}>
              <div
                className="payment-toggle-row"
                style={{ alignItems: 'center' }}
              >
                <div className="payment-toggle-info">
                  <strong>
                    🧰 {it.name}{' '}
                    {!it.is_active && (
                      <span style={{ color: '#9b3c32', fontSize: 12 }}>
                        (غیرفعال)
                      </span>
                    )}
                  </strong>
                  <small>
                    {it.location || '—'} · مالک: {ownerName(it.owner_id)}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12 }}
                    disabled={busy}
                    onClick={() =>
                      editId === it.id ? setEditId(null) : startEdit(it)
                    }
                  >
                    {editId === it.id ? 'بستن' : '✏️ ویرایش'}
                  </button>
                  <button
                    type="button"
                    className={`auto-switch ${it.is_active ? 'on' : 'off'}`}
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        updateCashRegister(it.id, { is_active: !it.is_active })
                      )
                    }
                    title={it.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                  >
                    <span className="auto-switch-track">
                      <span className="auto-switch-thumb" />
                    </span>
                  </button>
                </div>
              </div>

              {editId === it.id && (
                <div
                  style={{
                    border: '1px dashed #d8cfc0',
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 6,
                    marginBottom: 6,
                    background: '#fff',
                  }}
                >
                  <div className="form-grid" style={{ alignItems: 'end' }}>
                    <div className="field">
                      <label>نام صندوق</label>
                      <input
                        type="text"
                        value={eName}
                        onChange={(e) => setEName(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <label>محل استقرار</label>
                      <input
                        type="text"
                        placeholder="مثلاً: کانتر جلو"
                        value={eLocation}
                        onChange={(e) => setELocation(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <OwnerSelect users={users} value={eOwner} onChange={setEOwner} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn primary-btn"
                      disabled={busy || !eName.trim()}
                      onClick={async () => {
                        await run(() =>
                          updateCashRegister(it.id, {
                            name: eName,
                            location: eLocation || null,
                            owner_id: eOwner || null,
                          })
                        )
                        setEditId(null)
                      }}
                    >
                      💾 ذخیره
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditId(null)}
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div
            style={{
              borderTop: '1px dashed #e3ddd2',
              marginTop: 12,
              paddingTop: 12,
            }}
          >
            <div className="form-grid" style={{ alignItems: 'end' }}>
              <div className="field">
                <label>نام صندوق جدید</label>
                <input
                  type="text"
                  placeholder="مثلاً: صندوق بار"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label>محل استقرار (اختیاری)</label>
                <input
                  type="text"
                  placeholder="مثلاً: کانتر جلو"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={busy}
                />
              </div>
              <OwnerSelect users={users} value={owner} onChange={setOwner} />
            </div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 10 }}
              disabled={busy || !name.trim()}
              onClick={async () => {
                const n = name
                const l = location
                const o = owner
                setName('')
                setLocation('')
                setOwner('')
                await run(() => createCashRegister(n, l || null, o || null))
              }}
            >
              ➕ افزودن صندوق
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function BankAccountSection() {
  const [items, setItems] = useState<PaymentInstrument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // افزودن
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [iban, setIban] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [cardNo, setCardNo] = useState('')
  const [label, setLabel] = useState('')
  const [asReader, setAsReader] = useState(true)
  // ویرایش
  const [editId, setEditId] = useState<string | null>(null)
  const [e, setE] = useState({
    name: '',
    bank_name: '',
    iban: '',
    account_number: '',
    card_number: '',
    label: '',
    is_card_reader: true,
  })

  async function reload() {
    const res = await listPaymentInstruments()
    if (res.error) {
      setError(res.error)
    } else {
      setError(null)
      setItems(res.devices ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(fn: () => Promise<{ success?: boolean; error?: string }>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    if (res.error) setError(res.error)
    await reload()
    setBusy(false)
  }

  function startEdit(it: PaymentInstrument) {
    setEditId(it.id)
    setE({
      name: it.name,
      bank_name: it.bank_name ?? '',
      iban: it.iban ?? '',
      account_number: it.account_number ?? '',
      card_number: it.card_number ?? '',
      label: it.label ?? '',
      is_card_reader: it.is_card_reader,
    })
  }

  const summary = (it: PaymentInstrument) =>
    [
      it.bank_name,
      it.iban ? 'شبا: ' + it.iban : null,
      it.account_number ? 'حساب: ' + it.account_number : null,
      it.card_number ? 'کارت: ' + it.card_number : null,
      it.label,
    ]
      .filter(Boolean)
      .join(' · ') || '—'

  return (
    <section className="admin-card payment-section">
      <div className="payment-section-header-static">
        <div className="payment-section-icon">🏦</div>
        <div>
          <h2 className="payment-section-title">حساب‌های بانکی و کارتخوان‌ها</h2>
          <p className="payment-section-hint">
            مشخصات کامل هر حساب (شبا / حساب / کارت)؛ فقط حساب‌هایی که تیک
            «کارتخوان» دارند در زمان تسویه به کاربران نمایش داده می‌شوند
          </p>
        </div>
      </div>

      {loading ? (
        <p className="empty-admin">⏳ در حال بارگذاری...</p>
      ) : (
        <>
          {error && <div className="admin-error">❌ {error}</div>}
          {items.length === 0 && (
            <p className="empty-admin">هنوز حسابی نساخته‌ای — اولین را اضافه کن.</p>
          )}
          {items.map((it) => (
            <div key={it.id}>
              <div
                className="payment-toggle-row"
                style={{ alignItems: 'center' }}
              >
                <div className="payment-toggle-info">
                  <strong>
                    🏦 {it.name}{' '}
                    {!it.is_active && (
                      <span style={{ color: '#9b3c32', fontSize: 12 }}>
                        (غیرفعال)
                      </span>
                    )}
                  </strong>
                  <small>{summary(it)}</small>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: '1px solid ' + (it.is_card_reader ? '#2d5d3e' : '#e3ddd2'),
                      background: it.is_card_reader ? '#2d5d3e' : '#fff',
                      color: it.is_card_reader ? '#fff' : '#4b443b',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        updatePosDevice(it.id, {
                          is_card_reader: !it.is_card_reader,
                        })
                      )
                    }
                    title="تیک کارتخوان: در تسویه به‌عنوان کارت‌خوان نمایش داده شود"
                  >
                    {it.is_card_reader ? '✓ ' : ''}📟 کارتخوان
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12 }}
                    disabled={busy}
                    onClick={() =>
                      editId === it.id ? setEditId(null) : startEdit(it)
                    }
                  >
                    {editId === it.id ? 'بستن' : '✏️ ویرایش'}
                  </button>
                  <button
                    type="button"
                    className={`auto-switch ${it.is_active ? 'on' : 'off'}`}
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        updatePosDevice(it.id, { is_active: !it.is_active })
                      )
                    }
                    title={it.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                  >
                    <span className="auto-switch-track">
                      <span className="auto-switch-thumb" />
                    </span>
                  </button>
                </div>
              </div>

              {editId === it.id && (
                <div
                  style={{
                    border: '1px dashed #d8cfc0',
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 6,
                    marginBottom: 6,
                    background: '#fff',
                  }}
                >
                  <div className="form-grid" style={{ alignItems: 'end' }}>
                    <div className="field">
                      <label>نام حساب</label>
                      <input
                        type="text"
                        value={e.name}
                        onChange={(ev) => setE({ ...e, name: ev.target.value })}
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <label>نام بانک</label>
                      <input
                        type="text"
                        placeholder="مثلاً: بانک ملت"
                        value={e.bank_name}
                        onChange={(ev) =>
                          setE({ ...e, bank_name: ev.target.value })
                        }
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <label>شبا</label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="IR062960000000100000000001"
                        value={e.iban}
                        onChange={(ev) => setE({ ...e, iban: ev.target.value })}
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <label>شماره حساب</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={e.account_number}
                        onChange={(ev) =>
                          setE({ ...e, account_number: ev.target.value })
                        }
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <label>شماره کارت</label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="6037-9912-XXXX-XXXX"
                        value={e.card_number}
                        onChange={(ev) =>
                          setE({ ...e, card_number: ev.target.value })
                        }
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <label>برچسب (اختیاری)</label>
                      <input
                        type="text"
                        placeholder="مثلاً: کارت‌خوان کانتر"
                        value={e.label}
                        onChange={(ev) => setE({ ...e, label: ev.target.value })}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 10,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        fontSize: 12.5,
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: '1px solid ' + (e.is_card_reader ? '#2d5d3e' : '#e3ddd2'),
                        background: e.is_card_reader ? '#2d5d3e' : '#fff',
                        color: e.is_card_reader ? '#fff' : '#4b443b',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 600,
                      }}
                      disabled={busy}
                      onClick={() => setE({ ...e, is_card_reader: !e.is_card_reader })}
                    >
                      {e.is_card_reader ? '✓ ' : ''}📟 نمایش به‌عنوان کارت‌خوان در تسویه
                    </button>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="btn primary-btn"
                      disabled={busy || !e.name.trim()}
                      onClick={async () => {
                        await run(() =>
                          updatePosDevice(it.id, {
                            name: e.name,
                            bank_name: e.bank_name || null,
                            iban: e.iban || null,
                            account_number: e.account_number || null,
                            card_number: e.card_number || null,
                            label: e.label || null,
                            is_card_reader: e.is_card_reader,
                          })
                        )
                        setEditId(null)
                      }}
                    >
                      💾 ذخیره
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditId(null)}
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div
            style={{
              borderTop: '1px dashed #e3ddd2',
              marginTop: 12,
              paddingTop: 12,
            }}
          >
            <div className="form-grid" style={{ alignItems: 'end' }}>
              <div className="field">
                <label>نام حساب جدید</label>
                <input
                  type="text"
                  placeholder="مثلاً: حساب ملت — کانتر"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label>نام بانک</label>
                <input
                  type="text"
                  placeholder="مثلاً: بانک ملت"
                  value={bank}
                  onChange={(ev) => setBank(ev.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label>شبا</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="IR062960000000100000000001"
                  value={iban}
                  onChange={(ev) => setIban(ev.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label>شماره حساب</label>
                <input
                  type="text"
                  dir="ltr"
                  value={accountNo}
                  onChange={(ev) => setAccountNo(ev.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label>شماره کارت</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="6037-9912-XXXX-XXXX"
                  value={cardNo}
                  onChange={(ev) => setCardNo(ev.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label>برچسب (اختیاری)</label>
                <input
                  type="text"
                  placeholder="مثلاً: کارت‌خوان کانتر"
                  value={label}
                  onChange={(ev) => setLabel(ev.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 10,
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                style={{
                  fontSize: 12.5,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid ' + (asReader ? '#2d5d3e' : '#e3ddd2'),
                  background: asReader ? '#2d5d3e' : '#fff',
                  color: asReader ? '#fff' : '#4b443b',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontWeight: 600,
                }}
                disabled={busy}
                onClick={() => setAsReader(!asReader)}
              >
                {asReader ? '✓ ' : ''}📟 نمایش به‌عنوان کارت‌خوان در تسویه
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn"
                disabled={busy || !name.trim()}
                onClick={async () => {
                  const n = name
                  const payload = {
                    name: n,
                    bank_name: bank || null,
                    iban: iban || null,
                    account_number: accountNo || null,
                    card_number: cardNo || null,
                    label: label || null,
                    is_card_reader: asReader,
                  }
                  setName('')
                  setBank('')
                  setIban('')
                  setAccountNo('')
                  setCardNo('')
                  setLabel('')
                  setAsReader(true)
                  await run(() => createPosDevice(payload))
                }}
              >
                ➕ افزودن حساب
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default function PaymentSettingsManager() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const result = await getPaymentSettings()
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setSettings(result.data)
      }
      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof PaymentSettings>(
    key: K,
    value: PaymentSettings[K]
  ) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setMessage(null)
    setError(null)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    setError(null)

    const result = await updatePaymentSettings(settings)

    if (result.error) {
      setError(result.error)
    } else {
      setMessage('✅ تنظیمات ذخیره شد')
      setTimeout(() => setMessage(null), 3000)
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1>💳 تنظیمات پرداخت</h1>
            <p className="admin-subtitle">در حال بارگذاری...</p>
          </div>
        </div>
        <div className="admin-card">
          <p className="empty-admin">⏳ در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div><h1>💳 تنظیمات پرداخت</h1></div>
        </div>
        <div className="admin-card">
          <p className="empty-admin">❌ {error || 'خطا در بارگذاری تنظیمات'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-main payment-settings-page">
      <div className="admin-header">
        <div>
          <h1>💳 تنظیمات پرداخت</h1>
          <p className="admin-subtitle">مدیریت روش‌های پرداخت و درگاه‌های آنلاین</p>
        </div>
        <Link href="/admin/settings" className="btn">← تنظیمات</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">❌ {error}</div>}

      <section className="admin-card payment-section">
        <div className="payment-section-header">
          <div className="payment-section-icon">🔘</div>
          <div>
            <h2 className="payment-section-title">سیستم پرداخت</h2>
            <p className="payment-section-hint">وقتی خاموش باشه، همه سفارش‌ها فقط با «پرداخت نقدی» ثبت می‌شن</p>
          </div>
          <button
            type="button"
            className={`auto-switch ${settings.payment_enabled ? 'on' : 'off'}`}
            onClick={() => update('payment_enabled', !settings.payment_enabled)}
            disabled={saving}
          >
            <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
          </button>
        </div>

        {!settings.payment_enabled && (
          <div className="payment-warning">
            ⚠️ سیستم پرداخت خاموشه. تنظیمات زیر اعمال نمی‌شن تا کلید اصلی روشن شه.
          </div>
        )}
      </section>

      {settings.payment_enabled && (
        <>
          <section className="admin-card payment-section">
            <div className="payment-section-header-static">
              <div className="payment-section-icon">💰</div>
              <div>
                <h2 className="payment-section-title">روش‌های پرداخت</h2>
                <p className="payment-section-hint">مشتری‌ها می‌تونن از این روش‌ها انتخاب کنن</p>
              </div>
            </div>

            <div className="payment-methods-grid">
              <div className={`payment-method-card ${settings.payment_online_enabled ? 'active' : ''}`}>
                <div className="payment-method-icon">💳</div>
                <div className="payment-method-info"><strong>پرداخت آنلاین</strong><small>زرین‌پال / آیدی‌پی</small></div>
                <button type="button" className={`auto-switch ${settings.payment_online_enabled ? 'on' : 'off'}`} onClick={() => update('payment_online_enabled', !settings.payment_online_enabled)} disabled={saving}>
                  <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
                </button>
              </div>
                            <div className={`payment-method-card ${(settings.payment_cash_enabled || settings.payment_card_enabled) ? 'active' : ''}`}>
                <div className="payment-method-icon">💵</div>
                <div className="payment-method-info">
                  <strong>پرداخت در محل</strong>
                  <small>نقدی یا کارت‌خوان (توسط پرسنل)</small>
                </div>
                <button 
                  type="button" 
                  className={`auto-switch ${(settings.payment_cash_enabled || settings.payment_card_enabled) ? 'on' : 'off'}`} 
                  onClick={() => {
                    const newVal = !(settings.payment_cash_enabled || settings.payment_card_enabled)
                    update('payment_cash_enabled', newVal)
                    update('payment_card_enabled', false) // برای تمیزکاری دیتابیس
                  }} 
                  disabled={saving}
                >
                  <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
                </button>
              </div>
              <div className={`payment-method-card ${settings.payment_transfer_enabled ? 'active' : ''}`}>
                <div className="payment-method-icon">🏦</div>
                <div className="payment-method-info"><strong>واریز به حساب</strong><small>با آپلود رسید</small></div>
                <button type="button" className={`auto-switch ${settings.payment_transfer_enabled ? 'on' : 'off'}`} onClick={() => update('payment_transfer_enabled', !settings.payment_transfer_enabled)} disabled={saving}>
                  <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
                </button>
              </div>
              <div className={`payment-method-card ${settings.payment_wallet_enabled ? 'active' : ''}`}>
                <div className="payment-method-icon">👛</div>
                <div className="payment-method-info">
                  <strong>کیف پول مشتری</strong>
                  <small>پرداخت از موجودی + بازپرداخت لغو</small>
                </div>
                <button type="button" className={`auto-switch ${settings.payment_wallet_enabled ? 'on' : 'off'}`} onClick={() => update('payment_wallet_enabled', !settings.payment_wallet_enabled)} disabled={saving}>
                  <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
                </button>
              </div>
            </div>
          </section>

          {settings.payment_online_enabled && (
            <section className="admin-card payment-section">
              <div className="payment-section-header-static">
                <div className="payment-section-icon">🔧</div>
                <div>
                  <h2 className="payment-section-title">تنظیمات درگاه آنلاین</h2>
                  <p className="payment-section-hint">اطلاعات درگاه پرداخت اینترنتی</p>
                </div>
              </div>

              <div className="field">
                <label>درگاه پرداخت</label>
                <div className="payment-gateway-options">
                  {GATEWAY_OPTIONS.map((g) => (
                    <button key={g.value} type="button" className={`payment-gateway-option ${settings.payment_gateway === g.value ? 'active' : ''}`} onClick={() => update('payment_gateway', g.value)} disabled={saving}>
                      <span className="payment-gateway-option-icon">{g.icon}</span>
                      <span>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ✅ فیلد Merchant ID برگشت */}
              <div className="field" style={{ marginTop: '16px' }}>
                <label>
                  Merchant ID
                  <span className="payment-required">*</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settings.payment_merchant_id || ''}
                  onChange={(e) =>
                    update('payment_merchant_id', e.target.value.trim() || null)
                  }
                  disabled={saving}
                />
                <small>
                  کد ۳۶ کاراکتری که از پنل {settings.payment_gateway} دریافت
                  می‌کنی. (در دیتابیس امن ذخیره می‌شود)
                </small>
              </div>

              <div className="payment-toggle-row" style={{ marginTop: '16px' }}>
                <div className="payment-toggle-info">
                  <strong>حالت تست (Sandbox)</strong>
                  <small>توی این حالت، تراکنش‌ها واقعی نیستن و پولی جابجا نمی‌شه</small>
                </div>
                <button type="button" className={`auto-switch ${settings.payment_sandbox_mode ? 'on' : 'off'}`} onClick={() => update('payment_sandbox_mode', !settings.payment_sandbox_mode)} disabled={saving}>
                  <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
                </button>
              </div>

              {settings.payment_sandbox_mode && (
                <div className="payment-sandbox-warning">🧪 حالت تست فعاله — پول واقعی جابجا نمی‌شه</div>
              )}

              <div className="field" style={{ marginTop: '16px' }}>
                <label>حداقل مبلغ برای پرداخت آنلاین (تومان)</label>
                <input type="number" min="0" step="1000" placeholder="0 = بدون محدودیت" value={settings.payment_min_online_amount || 0} onChange={(e) => update('payment_min_online_amount', Math.max(0, Number(e.target.value) || 0))} disabled={saving} />
                <small>اگه مبلغ سفارش کمتر از این عدد باشه، فقط روش‌های حضوری نمایش داده می‌شن</small>
              </div>
            </section>
          )}

          {settings.payment_transfer_enabled && (
            <section className="admin-card payment-section">
              <div className="payment-section-header-static">
                <div className="payment-section-icon">🏦</div>
                <div>
                  <h2 className="payment-section-title">اطلاعات حساب بانکی</h2>
                  <p className="payment-section-hint">این اطلاعات به مشتری نمایش داده می‌شه تا واریز کنه</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field"><label>نام بانک</label><input type="text" placeholder="مثلاً: بانک ملی" value={settings.payment_transfer_bank_name || ''} onChange={(e) => update('payment_transfer_bank_name', e.target.value.trim() || null)} disabled={saving} /></div>
                <div className="field"><label>نام صاحب حساب</label><input type="text" placeholder="مثلاً: علی احمدی" value={settings.payment_transfer_account_holder || ''} onChange={(e) => update('payment_transfer_account_holder', e.target.value.trim() || null)} disabled={saving} /></div>
                <div className="field"><label>شماره حساب</label><input type="text" dir="ltr" inputMode="numeric" placeholder="1234567890" value={settings.payment_transfer_account_number || ''} onChange={(e) => update('payment_transfer_account_number', e.target.value.trim() || null)} disabled={saving} /></div>
                <div className="field"><label>شماره کارت</label><input type="text" dir="ltr" inputMode="numeric" placeholder="6037-XXXX-XXXX-XXXX" value={settings.payment_transfer_card_number || ''} onChange={(e) => update('payment_transfer_card_number', e.target.value.trim() || null)} disabled={saving} /></div>
              </div>

              <div className="payment-toggle-row">
                <div className="payment-toggle-info"><strong>نیاز به تأیید ادمین</strong><small>رسید آپلود شده باید توسط ادمین تأیید بشه تا سفارش تأیید نهایی بشه</small></div>
                <button type="button" className={`auto-switch ${settings.payment_transfer_requires_review ? 'on' : 'off'}`} onClick={() => update('payment_transfer_requires_review', !settings.payment_transfer_requires_review)} disabled={saving}>
                  <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* 🎯 پچ ۵۰-و-الف/ب: صندوق‌ها و حساب‌های بانکی — مستقل از کلید سیستم پرداخت */}
      <CashRegisterSection />
      <BankAccountSection />

      <div className="payment-save-bar">
        <button type="button" className="btn primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? '...' : '💾 ذخیره تنظیمات'}
        </button>
      </div>
    </div>
  )
}