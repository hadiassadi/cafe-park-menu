'use client'

import { useState } from 'react'

type Props = {
  orderId: string
  onSuccess: (receiptUrl: string) => void
}

export default function UploadReceipt({ orderId, onSuccess }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // اعتبارسنجی
    if (!file.type.startsWith('image/')) {
      setError('فقط عکس مجاز است (JPG، PNG، WEBP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('حجم عکس نباید بیشتر از ۵ مگابایت باشه')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // ۱. آپلود به Supabase Storage
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orderId', orderId)
      formData.append('type', 'receipt')

      const res = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'خطا در آپلود')
      }

      // ۲. ذخیره URL توی سفارش
      const updateRes = await fetch('/api/payment/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, receiptUrl: data.url }),
      })

      if (!updateRes.ok) {
        throw new Error('خطا در ذخیره رسید')
      }

      setPreview(data.url)
      onSuccess(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در آپلود')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="receipt-upload-box">
      {preview ? (
        <div className="receipt-preview">
          <img src={preview} alt="رسید واریز" />
          <div className="receipt-preview-hint">
            ✅ رسید آپلود شد — در انتظار تأیید کافه
          </div>
        </div>
      ) : (
        <>
          <label className="receipt-upload-label" htmlFor="receipt-input">
            <div className="receipt-upload-icon">📸</div>
            <div className="receipt-upload-text">
              <strong>آپلود عکس رسید</strong>
              <small>JPG، PNG — حداکثر ۵ مگابایت</small>
            </div>
            <input
              id="receipt-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>

          {uploading && (
            <div className="receipt-upload-progress">⏳ در حال آپلود...</div>
          )}

          {error && (
            <div className="receipt-upload-error">❌ {error}</div>
          )}
        </>
      )}
    </div>
  )
}