'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import Modal from '../components/Modal'
import { addTable, updateTable, deleteTable, rotateTableToken, rotateAllTableTokens } from './actions'

type Table = {
  id: string
  number: number
  name: string | null
  description: string | null
  capacity: number
  location: string
  is_active: boolean
  sort_order: number
  reservation_fee: number
  qr_token: string
}

type Props = {
  tables: Table[]
  siteUrl: string
}

const LOCATION_LABELS: Record<string, string> = {
  indoor: 'داخلی',
  outdoor: 'بیرونی',
  terrace: 'تراس',
  vip: 'VIP',
}

// 🎯 پچ ۵۰-ب: ارقام فارسی/عربی → انگلیسی — با کیبورد فارسی هم تایپ‌کردن کار می‌کند
function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

export default function TablesManager({ tables, siteUrl }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [qrTable, setQrTable] = useState<Table | null>(null)
  // 🎯 پچ ۵۰-ا: برگهٔ چاپ یکجای QR + وضعیت چرخش گروهی توکن‌ها
  const [printOpen, setPrintOpen] = useState(false)
  const [rotatingAll, setRotatingAll] = useState(false)

  // state فرم
  const [formNumber, setFormNumber] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCapacity, setFormCapacity] = useState('2')
  const [formLocation, setFormLocation] = useState('indoor')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formReservationFee, setFormReservationFee] = useState('0')
  const [formIsActive, setFormIsActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function resetForm() {
    setFormNumber('')
    setFormName('')
    setFormDescription('')
    setFormCapacity('2')
    setFormLocation('indoor')
    setFormSortOrder('0')
    setFormReservationFee('0')
    setFormIsActive(true)
    setMessage(null)
  }

  function openAddModal() {
    setEditingTable(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(table: Table) {
    setEditingTable(table)
    setFormNumber(String(table.number))
    setFormName(table.name ?? '')
    setFormDescription(table.description ?? '')
    setFormCapacity(String(table.capacity))
    setFormLocation(table.location)
    setFormSortOrder(String(table.sort_order))
    setFormReservationFee(String(table.reservation_fee ?? 0))
    setFormIsActive(table.is_active)
    setMessage(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingTable(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      if (editingTable) formData.append('id', editingTable.id)
      formData.append('number', formNumber)
      formData.append('name', formName)
      formData.append('description', formDescription)
      formData.append('capacity', formCapacity)
      formData.append('location', formLocation)
      formData.append('sort_order', formSortOrder)
      formData.append('reservation_fee', formReservationFee)
      if (formIsActive) formData.append('is_active', 'on')

      const result = editingTable
        ? await updateTable(formData)
        : await addTable(formData)

      if (result?.error) {
        setMessage('❌ ' + result.error)
        return
      }

      closeModal()
      window.location.reload()
    } catch {
      setMessage('❌ خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(table: Table) {
    if (!confirm(`مطمئنی می‌خوای میز ${table.number} رو حذف کنی؟`)) return

    const formData = new FormData()
    formData.append('id', table.id)

    const result = await deleteTable(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }
    window.location.reload()
  }

  // 🎯 پچ ۵۰-ا: چرخش توکن‌ها — تک‌میز و گروهی
  async function handleRotateAll() {
    if (
      !confirm(
        'چرخش همهٔ توکن‌ها یعنی همهٔ QRهای چاپ‌شدهٔ فعلی باطل می‌شن و باید برگهٔ جدید چاپ کنی. ادامه بدم؟'
      )
    )
      return

    setRotatingAll(true)
    try {
      const result = await rotateAllTableTokens()
      if (result?.error) {
        alert('❌ ' + result.error)
        return
      }
      window.location.reload()
    } finally {
      setRotatingAll(false)
    }
  }

  async function handleRotateOne(table: Table) {
    if (
      !confirm(
        `توکن میز ${table.number} عوض بشه؟ QR چاپ‌شدهٔ فعلی این میز باطل می‌شه.`
      )
    )
      return

    const formData = new FormData()
    formData.append('id', table.id)

    const result = await rotateTableToken(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }
    window.location.reload()
  }

  function getTableUrl(table: Table) {
    // 🎯 پچ ۵۰-ا: لینک امن با توکن تصادفی — شمارهٔ میز قابل حدس نیست
    return `${siteUrl}/t/${table.qr_token}`
  }

  function downloadQR(table: Table) {
    const svg = document.getElementById(`qr-${table.id}`)
    if (!svg) return

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)

    const canvas = document.createElement('canvas')
    const size = 1024
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const img = new Image()
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `table-${table.number}-qr.png`
        a.click()
        URL.revokeObjectURL(pngUrl)
      })

      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  // 🎯 پچ ۵۰-ج: چاپ برگه در پنجرهٔ مستقل با HTML خودکفا — SVGها سریالایز و
  // خارج از CSS اپ چاپ می‌شوند؛ @media print در globals.css همهٔ فرزندان body
  // جز .print-invoice را display:none می‌کند و چاپ در همین صفحه سفید می‌شد
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function printSheet() {
    const activeTables = tables.filter((t) => t.is_active)
    const svgs = document.querySelectorAll<SVGSVGElement>('.qr-print-sheet svg')

    if (svgs.length < activeTables.length) {
      alert('QRها هنوز کامل رندر نشده‌اند — یک لحظه صبر کن و دوباره بزن.')
      return
    }

    const serializer = new XMLSerializer()
    const cards = activeTables
      .map((t, i) => {
        const svg = svgs[i] ? serializer.serializeToString(svgs[i]) : ''
        return `<div class="card">
          <div class="qr">${svg}</div>
          <div class="t">میز #${t.number}${t.name ? ` — ${escapeHtml(t.name)}` : ''}</div>
          <div class="m">${LOCATION_LABELS[t.location] || t.location} · ${t.capacity} نفره</div>
          <div class="s">اسکن = مشاهدهٔ منو</div>
        </div>`
      })
      .join('')

    const win = window.open('', '_blank')
    if (!win) {
      alert('پنجرهٔ چاپ بلاک شد — اجازهٔ Popup را بده و دوباره بزن.')
      return
    }

    win.document.write(`<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8">
<title>QR میزها — کافه پارک</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: Tahoma, 'Segoe UI', sans-serif; margin: 0; padding: 8mm; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 4px; }
  .sub { text-align: center; color: #666; font-size: 12px; margin: 0 0 16px; }
  .grid { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; width: 180px; break-inside: avoid; page-break-inside: avoid; }
  .card svg { width: 140px; height: 140px; }
  .t { font-weight: 700; margin-top: 8px; font-size: 14px; }
  .m { color: #666; font-size: 12px; margin-top: 2px; }
  .s { color: #999; font-size: 10px; margin-top: 2px; }
</style>
</head>
<body>
<h1>☕ کافه پارک — QR میزها</h1>
<p class="sub">هر میز QR اختصاصی خودش رو داره؛ بعد از هر «چرخش توکن» این برگه رو دوباره چاپ کن.</p>
<div class="grid">${cards}</div>
<script>window.onload = function () { setTimeout(function () { window.print() }, 300) }<\/script>
</body>
</html>`)
    win.document.close()
  }

  return (
    <div className="tables-manager">
      <div className="admin-header">
        <div>
          <h1>🪑 مدیریت میزها</h1>
          <p className="admin-subtitle">
            میزهای کافه + QR کد اختصاصی برای هر میز
          </p>
        </div>
        <button
          type="button"
          className="btn primary-btn"
          onClick={openAddModal}
        >
          + افزودن میز
        </button>
      </div>

      {/* 🎯 پچ ۵۰-ب: نوار ابزار QR خارج از admin-header تا چیدمان هدر به‌هم نریزد */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setPrintOpen(true)}
        >
          🖨 چاپ QR میزها
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleRotateAll}
          disabled={rotatingAll}
        >
          {rotatingAll ? '...' : '🔄 چرخش توکن‌ها'}
        </button>
      </div>

      {tables.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">
            هنوز میزی اضافه نشده. روی «افزودن میز» بزن.
          </p>
        </div>
      ) : (
        <div className="tables-grid">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`table-card ${!table.is_active ? 'inactive' : ''}`}
            >
              <div className="table-card-header">
                <div className="table-number">#{table.number}</div>
                <div className="table-status">
                  {table.is_active ? '✓' : '×'}
                </div>
              </div>

              <div className="table-card-body">
                <div className="table-name">{table.name || `میز ${table.number}`}</div>
                {table.description && (
                  <div className="table-desc">{table.description}</div>
                )}

                <div className="table-meta">
                  <span>👥 {table.capacity} نفره</span>
                  <span>📍 {LOCATION_LABELS[table.location] || table.location}</span>
                  <span>
                    💳 رزرو:{' '}
                    {(table.reservation_fee ?? 0).toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>

              <div className="table-card-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setQrTable(table)}
                >
                  QR
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => openEditModal(table)}
                >
                  ویرایش
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => handleDelete(table)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ویرایش/افزودن */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTable ? `ویرایش میز ${editingTable.number}` : 'افزودن میز جدید'}
        subtitle={
          editingTable
            ? editingTable.name || ''
            : 'اطلاعات میز رو وارد کن'
        }
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={closeModal}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="table-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? '...' : editingTable ? 'ذخیره' : 'افزودن'}
            </button>
          </>
        }
      >
        <form id="table-form" onSubmit={handleSubmit}>
          {/* 🎯 پچ ۵۰-ب: نمایش پیام خطا — قبلاً خطاهای ذخیره بی‌صدا رد می‌شدند */}
          {message && (
            <p className="danger" style={{ margin: '0 0 12px' }}>
              {message}
            </p>
          )}
          <div className="form-grid">
            <div className="field">
              <label>شماره میز *</label>
              <input
                type="text"
                inputMode="numeric"
                value={formNumber}
                onChange={(e) => setFormNumber(normalizeDigits(e.target.value))}
                required
              />
            </div>

            <div className="field">
              <label>تعداد صندلی</label>
              <input
                type="text"
                inputMode="numeric"
                value={formCapacity}
                onChange={(e) => setFormCapacity(normalizeDigits(e.target.value))}
              />
            </div>

            <div className="field field-wide">
              <label>نام نمایشی</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثلاً میز ۱ - کنار پنجره"
              />
            </div>

            <div className="field field-wide">
              <label>توضیحات</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="مثلاً دنج کنار پنجره، رو به باغ..."
              />
            </div>

            <div className="field">
              <label>موقعیت</label>
              <select
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              >
                <option value="indoor">داخلی</option>
                <option value="outdoor">بیرونی</option>
                <option value="terrace">تراس</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            <div className="field">
              <label>ترتیب</label>
              <input
                type="text"
                inputMode="numeric"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(normalizeDigits(e.target.value))}
              />
            </div>

            <div className="field">
              <label>هزینهٔ پیش‌فرض رزرو</label>
              <input
                type="text"
                inputMode="numeric"
                value={formReservationFee}
                onChange={(e) =>
                  setFormReservationFee(normalizeDigits(e.target.value))
                }
                placeholder="مثلاً ۵۰۰۰۰"
              />
            </div>
          </div>

          <div className="check-row">
            <label className="check-label">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <span>میز فعال باشد</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Modal QR */}
      <Modal
        isOpen={!!qrTable}
        onClose={() => setQrTable(null)}
        title={`QR کد میز ${qrTable?.number ?? ''}`}
        subtitle={qrTable?.name ?? ''}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => setQrTable(null)}
            >
              بستن
            </button>
            {qrTable && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleRotateOne(qrTable)}
                >
                  🔄 چرخش توکن
                </button>
                <button
                  type="button"
                  className="btn primary-btn"
                  onClick={() => downloadQR(qrTable)}
                >
                  📥 دانلود PNG
                </button>
              </>
            )}
          </>
        }
      >
        {qrTable && (
          <div className="qr-preview">
            <div className="qr-box">
              <QRCodeSVG
                id={`qr-${qrTable.id}`}
                value={getTableUrl(qrTable)}
                size={256}
                level="H"
                includeMargin
              />
            </div>
            <div className="qr-url">{getTableUrl(qrTable)}</div>
            <p className="qr-hint">
              این QR رو روی میز بچسبون. مشتری با اسکن، منو با میز
              انتخاب‌شده باز می‌شه. لینک با توکن امن ساخته می‌شه و با
              «چرخش توکن» QRهای قبلی باطل می‌شن. (QRهای قدیمیِ شماره‌محور
              همچنان کار می‌کنن.)
            </p>
          </div>
        )}
      </Modal>

      {/* 🎯 پچ ۵۰-ا: برگهٔ چاپ یکجای QR همهٔ میزها — پیش‌نمایش روی صفحه
          🎯 پچ ۵۰-ج: چاپ واقعی با printSheet در پنجرهٔ مستقل انجام می‌شود،
          چون @media print در globals.css همهٔ فرزندان body جز .print-invoice را
          display:none می‌کند و چاپ در همین صفحه نتیجهٔ سفید می‌داد */}
      {printOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
          <div
            className="qr-print-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: '#fff',
              zIndex: 9999,
              overflow: 'auto',
              padding: 24,
              direction: 'rtl',
            }}
          >
            <div
              className="qr-print-actions"
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                className="btn primary-btn"
                onClick={printSheet}
              >
                🖨 چاپ
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPrintOpen(false)}
              >
                بستن
              </button>
            </div>
            <div className="qr-print-sheet">
              <h2 style={{ textAlign: 'center', margin: '8px 0 4px' }}>
                ☕ کافه پارک — QR میزها
              </h2>
              <p style={{ textAlign: 'center', color: '#666', margin: 0 }}>
                هر میز QR اختصاصی خودش رو داره؛ بعد از هر «چرخش توکن» این
                برگه رو دوباره چاپ کن.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  justifyContent: 'center',
                  marginTop: 16,
                }}
              >
                {tables
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <div
                      key={t.id}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        padding: 12,
                        textAlign: 'center',
                        width: 176,
                        breakInside: 'avoid',
                      }}
                    >
                      <QRCodeSVG
                        value={getTableUrl(t)}
                        size={140}
                        level="M"
                      />
                      <div style={{ fontWeight: 700, marginTop: 8 }}>
                        میز #{t.number}
                        {t.name ? ` — ${t.name}` : ''}
                      </div>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        {LOCATION_LABELS[t.location] || t.location} ·{' '}
                        {t.capacity} نفره
                      </div>
                      <div style={{ color: '#999', fontSize: 10 }}>
                        اسکن = مشاهدهٔ منو
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          </>,
          document.body
        )}
    </div>
  )
}