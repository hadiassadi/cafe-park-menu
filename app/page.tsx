// app/page.tsx  (Server Component، بدون 'use client')
import MenuClient from './MenuClient'
import { getMenuData } from '@/lib/menu'

// صفحه هر ۵ دقیقه تازه می‌شود. برای اعمال فوری تغییرات،
// بعد از ذخیره در پنل ادمین revalidatePath('/') را صدا بزن.
export const revalidate = 300

export default async function Page() {
  const data = await getMenuData()
  return <MenuClient initial={data} />
}
