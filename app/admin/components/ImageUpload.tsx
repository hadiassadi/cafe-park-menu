'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

type Props = {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
}

export default function ImageUpload({
  value,
  onChange,
  label = 'عکس محصول',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'خطا در آپلود')
      }

      onChange(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در آپلود')
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="image-upload">
      <label className="image-upload-label">{label}</label>

      <div className="image-upload-box">
        {value ? (
          <div className="image-upload-preview">
            <Image
              src={value}
              alt="پیش‌نمایش"
              width={120}
              height={120}
              style={{ objectFit: 'cover', borderRadius: 10 }}
            />
          </div>
        ) : (
          <div className="image-upload-empty">
            <span>📷</span>
            <small>عکسی انتخاب نشده</small>
          </div>
        )}

        <div className="image-upload-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? 'در حال آپلود...'
              : value
                ? '🔄 تغییر عکس'
                : '📤 انتخاب عکس'}
          </button>

          {value && (
            <button
              type="button"
              className="btn danger"
              onClick={() => onChange(null)}
              disabled={uploading}
            >
              🗑 حذف
            </button>
          )}
        </div>
      </div>

      {error && <div className="image-upload-error">❌ {error}</div>}
    </div>
  )
}