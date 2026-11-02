import 'server-only'
import { createHmac } from 'crypto'

function getSalt(): string {
  const salt = process.env.HASH_SALT
  if (!salt || salt.length < 32) {
    throw new Error('HASH_SALT is missing or too short (min 32 chars)')
  }
  return salt
}

export function hashData(value: string): string {
  if (!value) return ''

  // نرمالایز: حذف فاصله‌های اضافی، تبدیل حروف عربی به فارسی، حذف نیم‌فاصله
  const cleanValue = value
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ')

  return createHmac('sha256', getSalt()).update(cleanValue).digest('hex')
}
