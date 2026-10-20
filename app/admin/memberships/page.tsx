import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'
import MembershipsManager from './MembershipsManager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'باشگاه مشتریان | پنل ادمین',
}

export default async function MembershipsPage() {
  const db = supabaseAdmin()
  
  // خواندن لیست سازمان‌های ثبت‌شده
  const { data: organizations } = await db
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="admin-main">
      <div className="admin-header">
        <div>
          <h1>🎓 باشگاه مشتریان سازمانی</h1>
          <p className="admin-subtitle">مدیریت لیست اعضا، تخفیف‌ها و محدودیت‌های سازمان‌های طرف قرارداد</p>
        </div>
      </div>

      <MembershipsManager initialOrgs={organizations || []} />
    </div>
  )
}