import 'server-only'
import { requireAdmin } from '@/lib/admin/require-admin'

export async function assertAdmin(): Promise<void> {
  const denied = await requireAdmin()
  if (denied) {
    throw new Error(denied.status === 401 ? 'Unauthorized' : 'Forbidden')
  }
}

// برای Actionهایی که باید به‌جای پرتاب خطا، { error } برگردانند
export async function guardAdmin(): Promise<{ error: string } | null> {
  try {
    await assertAdmin()
    return null
  } catch (err: any) {
    return { error: err?.message || 'Unauthorized' }
  }
}
