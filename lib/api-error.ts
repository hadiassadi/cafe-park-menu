import { NextResponse } from 'next/server'

export function apiError(
  err: unknown,
  message = 'خطای غیرمنتظره',
  status = 500
) {
  console.error('[api]', err)
  return NextResponse.json({ error: message }, { status })
}
