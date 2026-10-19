'use client'

import { useState, useCallback, useRef } from 'react'

type StepUpResolver = (ok: boolean) => void

export function useStepUp() {
  const [modalOpen, setModalOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolverRef = useRef<StepUpResolver | null>(null)

  const requireStepUp = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setModalOpen(true)
      setError(null)
    })
  }, [])

  const close = useCallback(() => {
    if (verifying) return
    setModalOpen(false)
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
  }, [verifying])

  const verify = useCallback(async (password: string) => {
    setVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/stepup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'رمز اشتباه است')
        return
      }

      setModalOpen(false)
      if (resolverRef.current) {
        resolverRef.current(true)
        resolverRef.current = null
      }
    } catch {
      setError('خطا در ارتباط با سرور')
    } finally {
      setVerifying(false)
    }
  }, [])

  return {
    modalOpen,
    verifying,
    error,
    requireStepUp,
    close,
    verify,
  }
}