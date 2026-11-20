'use client'

import { useEffect } from 'react'

// 🎯 پچ ۵۳-ب — مودال مشترک پنل: برای همهٔ عملیات‌ها (ثبت سند خزانه، و بعداً
// تعریف کاربر، ویرایش پروفایل و…) از همین یک مؤلفه استفاده می‌شود
// - بستن با ✕، کلیک بیرون، یا Escape
// - wide برای فرم‌های جدولی چندستونه (مثل ادیتور سند)

export default function AdminModal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(40,32,20,.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'clamp(8px, 3vh, 28px) 12px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fffdf8',
          borderRadius: 14,
          border: '1px solid #e3ddd2',
          width: wide ? 'min(880px, 100%)' : 'min(520px, 100%)',
          maxHeight: 'calc(100vh - 2 * clamp(8px, 3vh, 28px))',
          overflowY: 'auto',
          padding: 16,
          boxShadow: '0 18px 50px rgba(0,0,0,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            position: 'sticky',
            top: -16,
            marginInline: -16,
            padding: '10px 16px',
            background: '#fffdf8',
            borderBottom: '1px solid #efe9dd',
            zIndex: 5,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="بستن"
            style={{
              border: 'none',
              background: '#f4efe6',
              cursor: 'pointer',
              fontSize: 14,
              borderRadius: 999,
              width: 30,
              height: 30,
              color: '#766f64',
              font: 'inherit',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
