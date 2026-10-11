'use client'

import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Modal from '../components/Modal'
import { addTable, updateTable, deleteTable } from './actions'

type Table = {
  id: string
  number: number
  name: string | null
  description: string | null
  capacity: number
  location: string
  is_active: boolean
  sort_order: number
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

export default function TablesManager({ tables, siteUrl }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [qrTable, setQrTable] = useState<Table | null>(null)

  // state فرم
  const [formNumber, setFormNumber] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCapacity, setFormCapacity] = useState('2')
  const [formLocation, setFormLocation] = useState('indoor')
  const [formSortOrder, setFormSortOrder] = useState('0')
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

  function getTableUrl(table: Table) {
    return `${siteUrl}/?table=${table.number}`
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
          <div className="form-grid">
            <div className="field">
              <label>شماره میز *</label>
              <input
                type="number"
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                required
                min="1"
              />
            </div>

            <div className="field">
              <label>تعداد صندلی</label>
              <input
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                min="1"
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
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
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
              <button
                type="button"
                className="btn primary-btn"
                onClick={() => downloadQR(qrTable)}
              >
                📥 دانلود PNG
              </button>
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
              انتخاب‌شده باز می‌شه.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}