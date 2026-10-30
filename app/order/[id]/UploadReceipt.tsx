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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [noteText, setNoteText] = useState('')

  // ✅ فقط فایل رو انتخاب می‌کنیم (بدون آپلود)
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    setSelectedFile(file)
  }

  // ✅ آپلود با کلیک روی دکمه ارسال
  async function handleUploadImage() {
    if (!selectedFile) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
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
        throw new Error('خطا در پردازش پاسخ سرور. لطفاً دوباره تلاش کنید.')
      }

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'خطا در آپلود')
      }

      const updateRes = await fetch('/api/payment/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, receiptUrl: data.url }),
      })

      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => null)
        throw new Error(errData?.error || 'خطا در ذخیره رسید')
      }


      onSuccess(data.url, null)
      setSelectedFile(null) 
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

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || 'خطا در ذخیره رسید')
      }

      onSuccess(null, noteText.trim())

    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="receipt-upload-box">
      <div className="receipt-mode-tabs">
        <button
          type="button"
          className={`receipt-mode-tab ${mode === 'image' ? 'active' : ''}`}
          onClick={() => { setMode('image'); setError(null) }}
          disabled={uploading}
        >
          📸 عکس رسید
        </button>
        <button
          type="button"
          className={`receipt-mode-tab ${mode === 'text' ? 'active' : ''}`}
          onClick={() => { setMode('text'); setError(null) }}
          disabled={uploading}
        >
          📝 متن رسید
        </button>
      </div>

      {mode === 'image' ? (
        <>
          {initialUrl ? (
            <div style={{ padding: '12px', background: '#e5f0e6', color: '#2d5d3e', borderRadius: '8px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>
              ✅ شما قبلاً رسید را آپلود کرده‌اید.
            </div>
          ) : (
            <>
              <label className="receipt-upload-label" htmlFor="receipt-input">
                <div className="receipt-upload-icon">📸</div>
                <div className="receipt-upload-text">
                  <strong>انتخاب عکس رسید</strong>
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

              {/* ✅ نمایش نام فایل انتخاب شده */}
              {selectedFile && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b4f3a', background: '#f5f0e9', padding: '8px', borderRadius: '6px' }}>
                  📎 فایل انتخاب شده: {selectedFile.name}
                </div>
              )}

              {/* ✅ دکمه ارسال دستی */}
              <button
                type="button"
                className="receipt-submit-btn"
                onClick={handleUploadImage}
                disabled={!selectedFile || uploading}
                style={{ marginTop: '10px', width: '100%' }}
              >
                {uploading ? 'در حال آپلود...' : '📤 ارسال رسید'}
              </button>
            </>
          )}
        </>
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
            style={{ marginTop: '10px', width: '100%' }}
          >
            {uploading ? '...' : '✅ ارسال متن رسید'}
          </button>
        </>
      )}

      {error && <div className="receipt-upload-error">❌ {error}</div>}
    </div>
  )
}