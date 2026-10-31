import 'server-only'
import { requireAdmin, requireAdminUser } from '@/lib/admin/require-admin'

export async function assertAdmin(): Promise<void> {
  const denied = await requireAdmin()
  if (denied) {
    throw new Error(denied.status === 401 ? 'Unauthorized' : 'Forbidden')
  }
}

// مثل assertAdmin، ولی شناسهٔ مدیر را هم برمی‌گرداند (برای ثبت verified_by)
export async function assertAdminId(): Promise<string> {
  const result = await requireAdminUser()
  if (result.denied) {
    throw new Error(result.denied.status === 401 ? 'Unauthorized' : 'Forbidden')
  }
  return result.userId
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
