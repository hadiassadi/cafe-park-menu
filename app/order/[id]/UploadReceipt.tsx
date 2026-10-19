'use client'

import { useState } from 'react'

type Props = {
  orderId: string
  onSuccess: (url: string | null, note: string | null) => void
  initialUrl?: string | null
}

export default function UploadReceipt({
  orderId,
  onSuccess,
  initialUrl,
}: Props) {
  const [mode, setMode] = useState<'image' | 'text'>('image')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null)
  const [noteText, setNoteText] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('فقط عکس مجاز است (JPG، PNG، WEBP)')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      setError('حجم عکس نباید بیشتر از ۳ مگابایت باشه')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orderId', orderId)

      const res = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      })

      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        console.error('Raw server response:', text)
        throw new Error(
          'خطا در پردازش پاسخ سرور. ممکن است حجم عکس زیاد باشد یا سرور شلوغ باشد. لطفاً از عکس کوچکتری استفاده کنید.'
        )
      }

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'خطا در آپلود')
      }

      const updateRes = await fetch('/api/payment/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, receiptUrl: data.url }),
      })

      if (!updateRes.ok) throw new Error('خطا در ذخیره رسید')

      setPreview(data.url)
      onSuccess(data.url, null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در آپلود')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmitText() {
    if (!noteText.trim()) {
      setError('لطفاً توضیحات رسید رو وارد کن')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const res = await fetch('/api/payment/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          receiptNote: noteText.trim(),
        }),
      })

      if (!res.ok) throw new Error('خطا در ذخیره رسید')

      onSuccess(null, noteText.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    } finally {
      setUploading(false)
    }
  }

  function handleReplaceReceipt() {
    setPreview(null)
    setError(null)
  }

  return (
    <div className="receipt-upload-box">
      <div className="receipt-mode-tabs">
        <button
          type="button"
          className={`receipt-mode-tab ${mode === 'image' ? 'active' : ''}`}
          onClick={() => setMode('image')}
          disabled={uploading}
        >
          📸 عکس رسید
        </button>
        <button
          type="button"
          className={`receipt-mode-tab ${mode === 'text' ? 'active' : ''}`}
          onClick={() => setMode('text')}
          disabled={uploading}
        >
          📝 متن رسید
        </button>
      </div>

      {mode === 'image' ? (
        preview ? (
          <div className="receipt-preview">
            <img src={preview} alt="رسید واریز" />
            <div className="receipt-preview-hint">
              ✅ رسید آپلود شد — در انتظار تأیید کافه
            </div>
            <button
              type="button"
              className="receipt-replace-btn"
              onClick={handleReplaceReceipt}
              disabled={uploading}
            >
              🔄 تغییر رسید
            </button>
          </div>
        ) : (
          <>
            <label className="receipt-upload-label" htmlFor="receipt-input">
              <div className="receipt-upload-icon">📸</div>
              <div className="receipt-upload-text">
                <strong>آپلود عکس رسید</strong>
                <small>JPG، PNG — حداکثر ۳ مگابایت</small>
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
          </>
        )
      ) : (
        <>
          <textarea
            className="receipt-note-input"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="مثلاً: ۱۰۰,۰۰۰ تومان از حساب بانک ملی به شماره کارت ... واریز شد. شماره پیگیری: 123456"
            rows={4}
            disabled={uploading}
          />
          <button
            type="button"
            className="receipt-submit-btn"
            onClick={handleSubmitText}
            disabled={uploading || !noteText.trim()}
          >
            {uploading ? '...' : '✅ ارسال رسید'}
          </button>
        </>
      )}

      {error && <div className="receipt-upload-error">❌ {error}</div>}
    </div>
  )
}