import 'server-only'
import { createHash } from 'crypto'

function getSalt(): string {
  const salt = process.env.HASH_SALT
  if (!salt || salt.length < 32) {
    throw new Error('HASH_SALT is missing or shorter than 32 characters')
  }
  return salt
}

export function hashData(value: string): string {
  if (!value) return ''

  const cleanValue = value
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ')

  return createHash('sha256').update(cleanValue + getSalt()).digest('hex')
}
