import 'server-only'
import crypto from 'crypto'

const STEPUP_COOKIE = '__stepup'
const STEPUP_TTL_MS = 15 * 60 * 1000

function getSecret(): string {
  const s = process.env.STEPUP_SECRET
  if (!s) throw new Error('STEPUP_SECRET env var is missing')
  return s
}

export function createStepUpToken(email: string): string {
  const expiry = Date.now() + STEPUP_TTL_MS
  const payload = `${email}|${expiry}`
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex')
  return Buffer.from(`${payload}|${signature}`).toString('base64url')
}

export async function verifyStepUpToken(
  token: string
): Promise<{ email: string } | null> {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 3) return null
    const [email, expiryStr, signature] = parts
    const expiry = parseInt(expiryStr, 10)
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null

    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(`${email}|${expiry}`)
      .digest('hex')

    const a = Buffer.from(signature, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return null
    if (!crypto.timingSafeEqual(a, b)) return null

    return { email }
  } catch {
    return null
  }
}

export function getStepUpCookieName(): string {
  return STEPUP_COOKIE
}

export function getStepUpTtlMs(): number {
  return STEPUP_TTL_MS
}