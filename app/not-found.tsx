import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="status-card">
        <div className="status-icon" aria-hidden="true">
          🔎
        </div>
        <h1>صفحه پیدا نشد</h1>
        <p>آدرسی که باز کردی وجود ندارد.</p>
        <Link href="/" className="status-btn">
          بازگشت به منو
        </Link>
      </div>
    </main>
  )
}
