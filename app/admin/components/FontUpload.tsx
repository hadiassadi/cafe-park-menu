'use client'

import { useRef, useState } from 'react'

type FontFile = {
  url: string
  name: string
  size?: number
  family?: string
  weight?: number
}

type Props = {
  value: FontFile[]
  onChange: (files: FontFile[]) => void
  label?: string
  previewFamily?: string
}

export default function FontUpload({
  value,
  onChange,
  label = 'فونت‌های قالب',
  previewFamily,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) {
      setSelectedFiles([...selectedFiles, ...files])
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeNewFile(index: number) {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  function formatSize(bytes?: number) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const uniqueFamilies = new Set(
    value.filter((f) => f.family).map((f) => f.family)
  ).size

  return (
    <div className="font-upload">
      <label className="font-upload-label">{label}</label>

      {value.length > 0 && (
        <div className="font-upload-stats">
          <div className="font-stat">
            <span className="font-stat-icon">📁</span>
            <div>
              <strong>{value.length}</strong>
              <small>فایل فونت</small>
            </div>
          </div>

          <div className="font-stat">
            <span className="font-stat-icon">🎨</span>
            <div>
              <strong>{uniqueFamilies}</strong>
              <small>خانواده</small>
            </div>
          </div>
        </div>
      )}

      <div className="font-upload-box">
        <div className="font-upload-info">
          <strong>📁 افزودن فایل فونت جدید</strong>
          <p>
            چند فایل TTF, OTF, WOFF یا WOFF2 رو همزمان انتخاب کن.
            خانواده و وزن <b>خودکار</b> تشخیص داده می‌شه.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          name="font_files"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
          multiple
          onChange={handleChange}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className="btn primary-btn"
          onClick={() => inputRef.current?.click()}
        >
          📤 انتخاب فایل‌ها
        </button>
      </div>

      {/* ✅ پیش‌نمایش فونت */}
      {previewFamily && (
        <div className="font-preview">
          <div className="font-preview-label">👁 پیش‌نمایش فونت</div>

          <div
            className="font-preview-text"
            style={{ fontFamily: previewFamily }}
          >
            قهوه فقط یه نوشیدنی نیست، یه بهونه‌ست برای نفس کشیدن.
          </div>

          <div
            className="font-preview-text small"
            style={{ fontFamily: previewFamily }}
          >
            ۱۴۰,۰۰۰ تومان — کافه پارک شیراز
          </div>

          <div
            className="font-preview-text small"
            style={{ fontFamily: previewFamily }}
          >
            ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="font-upload-list">
          <div className="font-upload-list-title">
            📎 فایل‌های جدید ({selectedFiles.length})
          </div>

          {selectedFiles.map((file, index) => (
            <div key={index} className="font-upload-item">
              <div className="font-upload-item-info">
                <strong>{file.name}</strong>
                <small>{formatSize(file.size)}</small>
              </div>

              <button
                type="button"
                className="btn danger"
                onClick={() => removeNewFile(index)}
                style={{ padding: '6px 10px', fontSize: 11 }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}