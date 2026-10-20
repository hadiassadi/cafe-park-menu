import 'server-only'
import { createHash } from 'crypto'

const SALT = process.env.HASH_SALT || 'cafe-park-secret-salt-1405'

export function hashData(value: string): string {
  if (!value) return ''
  
  // ✅ نرمالایز کردن قوی: حذف فاصله‌های اضافی، تبدیل حروف عربی به فارسی، حذف نیم‌فاصله
  const cleanValue = value
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, '') // حذف نیم‌فاصله (ZWNJ)
    .replace(/\s+/g, ' ')   // تبدیل چند فاصله به یک فاصله
    
  return createHash('sha256').update(cleanValue + SALT).digest('hex')
}