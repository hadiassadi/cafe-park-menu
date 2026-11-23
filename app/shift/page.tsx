import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { peekStaffShiftCookie } from '@/lib/admin/shift-auth'
import StaffOtpForm from './StaffOtpForm'
import ShiftCard from './ShiftCard'

export const metadata: Metadata = {
  title: 'شیفت من — کافه پارک',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۴ — صفحهٔ موبایل شیفت (بیرون از پنل، آدرس: /shift):
// کارمند با شمارهٔ موبایل + کد پیامکی وارد می‌شود و شیفت باز/بسته می‌کند؛
// هرکس با جلسهٔ پنل بیاید (مثلاً مالک روی گوشی) مستقیم کارت شیفت را می‌بیند.
// این صفحه هیچ دادهٔ حساسی نشان نمی‌دهد — همهٔ عملیات واقعی سمت API گارد دارد.

const wrap: CSSProperties = {
  minHeight: '100dvh',
  background: '#f6f1e9',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '24px 16px',
  direction: 'rtl',
}

export default async function ShiftPage() {
  const admin = await requireAdminUser()
  const staff = await peekStaffShiftCookie()
  const authorized = !admin.denied || !!staff

  return (
    <main style={wrap}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>☕ کافه پارک</div>
        <div style={{ fontSize: 14, color: '#766f64', marginTop: 4 }}>
          ⏱ شیفت من — باز و بستن شیفت از گوشی
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 430 }}>
        {authorized ? <ShiftCard /> : <StaffOtpForm />}
      </div>
      <a
        href="/"
        style={{
          marginTop: 20,
          fontSize: 13,
          color: '#4a7fa5',
          textDecoration: 'none',
        }}
      >
        🌐 مشاهده منو
      </a>
    </main>
  )
}
