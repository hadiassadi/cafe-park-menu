// app/admin/page.tsx
// 🎯 پچ ۶۷ — بازسازی کامل داشبورد نقش‌آگاه
// 🎯 پچ ۶۸ — کپشن صفر کارت‌ها، شناسهٔ کوتاه و مبلغِ دفاعی سفارش‌های اخیر
// 🎯 پچ ۷۰ — نوار وضعیت ثابت + دسترسی مالی برای نقش سفارشیِ دارای «گزارش فروش»
// 🎯 پچ ۷۱ — سرعت (آمار سبک ۳۵ روزه) + لود تنبل تب‌ها + آمار شخصی operator_id
// 🎯 پچ ۷۲ — داشبورد قابل تنظیم برای هر کاربر:
//   • هر بخش آماری = یک «ویجت» = یک تب مستقل؛ کاربر از «⚙️ تنظیم داشبورد»
//     تیک می‌زند کدام بخش‌ها باشند — ذخیره برای حسابِ خودش (dashboard_prefs)
//   • ترتیب تب‌ها = ترتیب اولویت رجیستری: صندوق و بانک ← نمودارها ←
//     پرفروش‌ها ← سفارش‌های اخیر ← ابزارها
//   • ویجت جدید «صندوق و بانک امروز»: وجه نقد صندوق / کارتخوان / آنلاین /
//     کارت‌به‌کارتِ امروز از order_payments تأییدشده (همان منبع صفحهٔ شیفت‌ها)
//   • کارت‌های هیرو (امروز/ماه) همیشه بالای داشبورد می‌مانند
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { getOperatorRole } from '@/lib/admin/roles'
import { accessAllowsPath } from '@/lib/admin/modules'
import { getQuickStats, getOperatorStats } from '@/lib/dashboard-stats'
import {
  DASHBOARD_WIDGETS,
  type DashboardWidgetId,
  canSeeFinanceFor,
  defaultWidgetsFor,
  sanitizeWidgets,
  widgetsForRole,
} from '@/lib/admin/dashboard-widgets'
import { supabaseAdmin } from '@/lib/supabase/server'
import CleanupOrdersCard from './components/CleanupOrdersCard'
import ChartsPanel from './components/ChartsPanel'
import TopProductsPanel from './components/TopProductsPanel'
import DashboardSettings from './components/DashboardSettings'
import SectionTabs, { type SectionTabDef } from './components/SectionTabs'
import './admin-dashboard.css'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

// برچسب وضعیت سفارش — مقدار ناشناخته همان متن خام نشان داده می‌شود (بدون کرش)
const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأییدشده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده',
  delivering: 'در حال ارسال',
  delivered: 'تحویل‌شده',
  completed: 'تکمیل‌شده',
  paid: 'پرداخت‌شده',
  unpaid: 'پرداخت‌نشده',
  cancelled: 'لغو شده',
  canceled: 'لغو شده',
}

const statusLabel = (v: unknown) =>
  STATUS_LABELS[String(v).toLowerCase()] ?? String(v)

const fmtDateTime = (v: unknown) => {
  try {
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('fa-IR', {
      timeZone: 'Asia/Tehran',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// مبلغ را از هر شکلی (عدد یا رشتهٔ عددی) به عدد می‌رساند؛ مقدار نامعتبر → null
const parseAmount = (v: unknown): number | null => {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[,\s]/g, ''))
    if (isFinite(n)) return n
  }
  return null
}

// 🎯 پچ ۷۱: شمارهٔ واقعی سفارش (order_number) — fallback شناسهٔ کوتاه
const displayOrderId = (row: Record<string, unknown>, fallback: number) => {
  const orderNumber = Number(row.order_number)
  if (Number.isFinite(orderNumber) && orderNumber > 0) {
    return String(orderNumber)
  }
  const s = String(row.id ?? '').trim()
  if (!s) return String(fallback + 1)
  return s.split('-')[0].toUpperCase().slice(0, 8)
}

// سفارش‌های اخیر — ستون‌های مشخص و فیلترهای امن؛ operatorId → فقط شخصی
async function fetchRecentOrders(
  operatorId?: string
): Promise<Record<string, unknown>[] | null> {
  try {
    const db = supabaseAdmin()
    let q = db
      .from('orders')
      .select('id, order_number, status, subtotal, created_at, operator_id')
      .is('deleted_at', null)
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(6)
    if (operatorId) q = q.eq('operator_id', operatorId)
    const { data, error } = await q
    if (error || !data || data.length === 0) return null
    return data as Record<string, unknown>[]
  } catch {
    return null
  }
}

// 🎯 پچ ۷۲: صندوق و بانک امروز — تجمیع پرداخت‌های تأییدشدهٔ امروز بر اساس
// روش پرداخت (همان منبعِ گزارش شیفت‌ها: order_payments: method/amount/status)
type CashToday = {
  cash: number
  card: number
  online: number
  transfer: number
  total: number
  ok: boolean
}

async function fetchCashToday(): Promise<CashToday> {
  const empty: CashToday = {
    cash: 0,
    card: 0,
    online: 0,
    transfer: 0,
    total: 0,
    ok: false,
  }
  try {
    const db = supabaseAdmin()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const { data, error } = await db
      .from('order_payments')
      .select('method, amount, created_at')
      .eq('status', 'confirmed')
      .gte('created_at', start.toISOString())
    if (error || !data) {
      console.error('[dashboard cash] error:', error)
      return empty
    }
    const out: CashToday = { ...empty, ok: true }
    for (const p of data) {
      const amount = Number(p.amount) || 0
      out.total += amount
      switch (String(p.method).toLowerCase()) {
        case 'cash':
          out.cash += amount
          break
        case 'card':
          out.card += amount
          break
        case 'online':
          out.online += amount
          break
        case 'transfer':
          out.transfer += amount
          break
      }
    }
    return out
  } catch (err) {
    console.error('[dashboard cash] unexpected:', err)
    return empty
  }
}

// 🎯 پچ ۷۳: موجودی فعلی هر خزانه (صندوق/بانک) از دفتر کل — همان منطق
// گزارش حسابداری (lib/accounting/reports.ts) ولی بدون فیلتر تاریخ تا
// ترازِ تجمعی حساب‌های kind='treasury' به دست بیاید:
//   موجودی = Σ(بدهکار − بستانکار) همهٔ زمان‌ها برای هر حساب خزانه
type TreasuryBal = {
  name: string
  treasuryType: string | null
  bal: number
}

async function fetchTreasuryBalances(): Promise<{
  ok: boolean
  rows: TreasuryBal[]
}> {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('gl_lines')
      .select(
        'side, amount, account_id, gl_accounts(name, kind, treasury_type)'
      )
    if (error || !data) {
      console.error('[dashboard treasury] error:', error)
      return { ok: false, rows: [] }
    }
    const byAcc: Record<
      string,
      { name: string; treasuryType: string | null; bal: number }
    > = {}
    for (const l of data) {
      const acc = l.gl_accounts as {
        name?: string
        kind?: string
        treasury_type?: string
      } | null
      if (!acc || acc.kind !== 'treasury') continue
      const rec = (byAcc[l.account_id] ??= {
        name: String(acc.name ?? ''),
        treasuryType: acc.treasury_type ?? null,
        bal: 0,
      })
      const amt = Number(l.amount) || 0
      rec.bal += l.side === 'debit' ? amt : -amt
    }
    const rows = Object.values(byAcc).sort((a, b) => {
      // صندوق نقدی اول، بعد حساب‌های بانکی به ترتیب الفبا
      const cashA = /صندوق|نقد/.test(a.name) ? 0 : 1
      const cashB = /صندوق|نقد/.test(b.name) ? 0 : 1
      return cashA - cashB || a.name.localeCompare(b.name, 'fa')
    })
    return { ok: true, rows }
  } catch (err) {
    console.error('[dashboard treasury] unexpected:', err)
    return { ok: false, rows: [] }
  }
}

function HeroStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: string
  label: string
  value: number
  tone?: 'gold' | 'green' | 'plain'
}) {
  return (
    <div className={`dash-hero-card${tone ? ` tone-${tone}` : ''}`}>
      <div className="dash-hero-icon">{icon}</div>
      <div className="dash-hero-value">{formatPrice(value)}</div>
      <div className="dash-hero-label">{label}</div>
      {value === 0 && (
        <div className="dash-hero-zero">هنوز در این بازه چیزی ثبت نشده</div>
      )}
    </div>
  )
}

export default async function AdminDashboard() {
  // 🎯 گیت نشست + شناسهٔ کاربر (آمار شخصی + کلید تنظیمات داشبورد)
  const auth = await requireAdminUser()
  if (auth.denied || !auth.userId) redirect('/admin/login')
  const userId = auth.userId

  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')

  const role = me.role
  const isOwner = role === 'owner'
  const canSeeFinance = canSeeFinanceFor(role, me.allowedPaths)

  const allows = (href: string) =>
    accessAllowsPath(role, me.allowedPaths, href)
  const canRegisterOrder = allows('/admin/orders/new')

  // ── داده‌ها: آمار سبک + سفارش‌های اخیر + (مالک/مدیر) صندوق و خزانه‌ها ──
  const [quickStats, operatorStats, recentOrders, cashToday, treasury] =
    await Promise.all([
      canSeeFinance ? getQuickStats() : Promise.resolve(null),
      canSeeFinance ? Promise.resolve(null) : getOperatorStats(userId),
      canSeeFinance ? fetchRecentOrders() : fetchRecentOrders(userId),
      canSeeFinance ? fetchCashToday() : Promise.resolve(null),
      canSeeFinance ? fetchTreasuryBalances() : Promise.resolve(null),
    ])

  // 🎯 پچ ۷۲: چیدمان ذخیره‌شدهٔ این کاربر (یا پیش‌فرض نقشش)
  let savedWidgets: DashboardWidgetId[] | null = null
  try {
    const db = supabaseAdmin()
    const { data: prefRow, error: prefErr } = await db
      .from('dashboard_prefs')
      .select('widgets')
      .eq('user_id', userId)
      .maybeSingle()
    if (!prefErr && prefRow?.widgets) {
      savedWidgets = sanitizeWidgets(prefRow.widgets, role, canSeeFinance)
    }
  } catch {}
  const activeWidgets =
    savedWidgets ?? defaultWidgetsFor(role, canSeeFinance)

  // ویجت‌های در دسترس این نقش — برای مودال تنظیم داشبورد
  const availableWidgets = widgetsForRole(role, canSeeFinance).map(
    ({ id, label, icon, description }) => ({ id, label, icon, description })
  )

  // ── کارت‌های هیرو (همیشه بالای داشبورد — خارج از تیک‌ها) ──
  const heroCards = canSeeFinance
    ? [
        <HeroStat
          key="rev-today"
          icon="💰"
          label="فروش امروز (تومان)"
          value={quickStats?.today.revenue ?? 0}
          tone="gold"
        />,
        <HeroStat
          key="ord-today"
          icon="🛒"
          label="سفارش امروز"
          value={quickStats?.today.orders ?? 0}
          tone="green"
        />,
        <HeroStat
          key="rev-month"
          icon="🗓️"
          label="فروش این ماه (تومان)"
          value={quickStats?.month.revenue ?? 0}
        />,
      ]
    : [
        <HeroStat
          key="my-rev-today"
          icon="💰"
          label="فروش امروز من (تومان)"
          value={operatorStats?.today.revenue ?? 0}
          tone="gold"
        />,
        <HeroStat
          key="my-ord-today"
          icon="🛒"
          label="سفارش‌های امروز من"
          value={operatorStats?.today.orders ?? 0}
          tone="green"
        />,
        <HeroStat
          key="my-rev-month"
          icon="🗓️"
          label="فروش این ماه من (تومان)"
          value={operatorStats?.month.revenue ?? 0}
        />,
      ]

  /* ── ویجت «صندوق و بانک» — اولویت اول مالک/مدیر ──
     🎯 پچ ۷۳: موجودی فعلی هر خزانه از دفتر کل + ورودی امروز به تفکیک روش */
  const cashSection = (
    <section className="dashboard-section">
      <h2>
        💵 صندوق و بانک
        <small className="dash-section-note">
          موجودی فعلی خزانه‌ها از دفتر کل + ورودی امروز
        </small>
      </h2>

      {/* موجودی فعلی خزانه‌ها — تراز تجمعی حساب‌های kind=treasury */}
      {treasury?.ok && treasury.rows.length > 0 && (
        <>
          <div className="dash-hero">
            {treasury.rows.map((t) => {
              const isCash = /صندوق|نقد/.test(t.name)
              return (
                <div
                  key={t.name}
                  className={`dash-hero-card${isCash ? ' tone-gold' : ''}`}
                >
                  <div className="dash-hero-icon">{isCash ? '💵' : '🏦'}</div>
                  <div className="dash-hero-value">
                    {formatPrice(t.bal)}
                  </div>
                  <div className="dash-hero-label">
                    {t.name} (تومان)
                  </div>
                  {t.bal === 0 && (
                    <div className="dash-hero-zero">
                      بدون گردش ثبت‌شده تا امروز
                    </div>
                  )}
                  {t.bal < 0 && (
                    <div className="dash-hero-zero">
                      منفی — ثبت‌های این حساب نیاز به بررسی دارد
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="admin-card dash-cash-total">
            🏛️ جمع موجودی همهٔ خزانه‌ها:{' '}
            <strong>
              {formatPrice(
                treasury.rows.reduce((s, t) => s + t.bal, 0)
              )}{' '}
              تومان
            </strong>
          </div>
        </>
      )}
      {treasury && !treasury.ok && (
        <div className="admin-card dash-treasury-note">
          موجودی خزانه‌ها فعلاً در دسترس نیست — ماژول حسابداری (دفتر کل) هنوز
          فعال نشده یا اولین سند ثبت نشده است.
        </div>
      )}

      {/* ورودی امروز به تفکیک روش پرداخت */}
      {cashToday?.ok ? (
        <>
          <h3 className="dash-subhead">ورودی امروز</h3>
          <div className="dash-hero">
            <div className="dash-hero-card tone-green">
              <div className="dash-hero-icon">🪙</div>
              <div className="dash-hero-value">
                {formatPrice(cashToday.cash)}
              </div>
              <div className="dash-hero-label">وجه نقد دریافتی (تومان)</div>
            </div>
            <div className="dash-hero-card">
              <div className="dash-hero-icon">💳</div>
              <div className="dash-hero-value">
                {formatPrice(cashToday.card)}
              </div>
              <div className="dash-hero-label">کارتخوان (تومان)</div>
            </div>
            <div className="dash-hero-card">
              <div className="dash-hero-icon">🌐</div>
              <div className="dash-hero-value">
                {formatPrice(cashToday.online)}
              </div>
              <div className="dash-hero-label">پرداخت آنلاین (تومان)</div>
            </div>
            <div className="dash-hero-card">
              <div className="dash-hero-icon">🔁</div>
              <div className="dash-hero-value">
                {formatPrice(cashToday.transfer)}
              </div>
              <div className="dash-hero-label">کارت‌به‌کارت/انتقال (تومان)</div>
            </div>
          </div>
          <div className="admin-card dash-cash-total">
            🧾 جمع کل ورودی امروز:{' '}
            <strong>{formatPrice(cashToday.total)} تومان</strong>
          </div>
        </>
      ) : (
        <div className="admin-card">
          <p className="empty-admin">
            دادهٔ پرداخت‌ها فعلاً در دسترس نیست — اگر تازه SQL نسخه‌های قبل
            را اجرا کرده‌ای، یک پرداخت تأییدشده ثبت کن و دوباره بیا.
          </p>
        </div>
      )}
    </section>
  )

  /* ── ویجت «سفارش‌های اخیر» ── */
  const recentOrdersTitle = canSeeFinance
    ? '🧾 سفارش‌های اخیر'
    : '🧾 سفارش‌های اخیر من'

  const recentOrdersSection = recentOrders ? (
    <section className="dashboard-section">
      <h2>{recentOrdersTitle}</h2>
      <div className="dash-recent">
        {recentOrders.map((o, i) => {
          const total = parseAmount(o.subtotal)
          const status = o.status
          return (
            <div key={String(o.id ?? i)} className="dash-recent-row">
              <span className="dash-recent-id">
                #{displayOrderId(o, i)}
              </span>
              {o.created_at ? (
                <span className="dash-recent-time">
                  {fmtDateTime(o.created_at)}
                </span>
              ) : null}
              {status ? (
                <span className={`dash-status s-${String(status)}`}>
                  {statusLabel(status)}
                </span>
              ) : null}
              {total !== null ? (
                <span className="dash-recent-amount">
                  {formatPrice(total)} تومان
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {canSeeFinance && allows('/admin/orders') && (
        <Link href="/admin/orders" className="dash-recent-more">
          مشاهدهٔ همهٔ سفارش‌ها ←
        </Link>
      )}
    </section>
  ) : (
    <section className="dashboard-section">
      <h2>{recentOrdersTitle}</h2>
      <div className="admin-card">
        <p className="empty-admin">
          {canSeeFinance
            ? 'هنوز سفارشی ثبت نشده است.'
            : 'هنوز سفارشی با نام تو ثبت نشده — با ثبت اولین سفارش، آمار شخصی‌ات همین‌جا دیده می‌شود.'}
        </p>
      </div>
    </section>
  )

  const cleanupSection = (
    <section className="dashboard-section">
      <h2>🧹 نگهداری دیتابیس</h2>
      <CleanupOrdersCard />
    </section>
  )

  // ── 🎯 پچ ۷۲: هر ویجت = یک تب مستقل؛ ترتیب = انتخاب ذخیره‌شدهٔ کاربر ──
  const widgetNodes: Record<DashboardWidgetId, ReactNode> = {
    cash: cashSection,
    charts: <ChartsPanel />,
    top: <TopProductsPanel />,
    recent: recentOrdersSection,
    tools: cleanupSection,
  }

  const tabs: SectionTabDef[] = activeWidgets.map((id) => {
    const def = DASHBOARD_WIDGETS.find((w) => w.id === id)
    return {
      id,
      icon: def?.icon ?? '📄',
      label: def?.label ?? id,
      node: widgetNodes[id],
    }
  })

  return (
    <div className="dashboard">
      {/* خوش‌آمد + CTA + دکمهٔ تنظیم داشبورد */}
      <div className="dashboard-welcome dash-welcome">
        <div>
          <h1>👋 خوش آمدی</h1>
          <p>
            {canSeeFinance
              ? 'خلاصهٔ عملکرد کافه پارک در یک نگاه'
              : 'خلاصهٔ عملکرد خودت در یک نگاه'}
          </p>
        </div>
        <div className="dash-welcome-side">
          <DashboardSettings
            widgets={availableWidgets}
            initialWidgets={activeWidgets}
          />
          {canRegisterOrder && (
            <Link href="/admin/orders/new" className="dash-cta">
              ➕ ثبت سفارش حضوری
            </Link>
          )}
        </div>
      </div>

      {/* کارت‌های هیرو — همیشه دیده می‌شوند (استاندارد پایهٔ داشبورد) */}
      <section className="dashboard-section">
        <div className="dash-hero">{heroCards}</div>
      </section>

      {/* تب‌های ویجت — بر اساس انتخاب خود کاربر */}
      {tabs.length > 0 && <SectionTabs tabs={tabs} />}
    </div>
  )
}
