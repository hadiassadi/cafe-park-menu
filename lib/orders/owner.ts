import 'server-only'
import { cookies } from 'next/headers'
import { hashData } from '@/lib/utils/hash'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getDeviceHash(): Promise<string | null> {
  const store = await cookies()
  const token = store.get('cafe_device_token')?.value
  return token ? hashData(token) : null
}
