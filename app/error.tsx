'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="status-page">
      <div className="status-card">
        <div className="status-icon" aria-hidden="true">
          ☕
        </div>
        <h1>مشکلی پیش آمد</h1>
        <p>منو الان بارگذاری نشد. چند لحظه دیگر دوباره تلاش کن.</p>
        <button type="button" className="status-btn" onClick={reset}>
          تلاش دوباره
        </button>
      </div>
    </main>
  )
}
