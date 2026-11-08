'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listGrades,
  saveGrade,
  deleteGrade,
  saveGradePolicy,
  type AdminGrade,
  type GradePolicyForm,
} from './actions'
import { DISCOUNT_POLICY_LABELS, type DiscountPolicy } from '@/lib/club/discount-policy'

const POLICY_HINTS: Record<DiscountPolicy, string> = {
  max: 'هرکدام بیشتر باشد اعمال می‌شود',
  membership_first: 'تخفیف باشگاه اولویت دارد؛ گرید فقط وقتی تخفیف باشگاهی در کار نباشد',
  grade_first: 'تخفیف گرید اولویت دارد؛ باشگاه فقط وقتی گرید تخفیفی نداشته باشد',
  stacked: 'جمع تخفیف باشگاه و گرید، با سقف درصدی',
}

type DraftGrade = {
  id: string | null
  name: string
  min_total: string
  discount_percent: string
  color: string
  sort_order: string
  is_active: boolean
}

const EMPTY_DRAFT: DraftGrade = {
  id: null,
  name: '',
  min_total: '0',
  discount_percent: '0',
  color: '#6b4f3a',
  sort_order: '10',
  is_active: true,
}

const formatPrice = (n: number) => new Intl.NumberFormat('fa-IR').format(n)

export default function GradesManager() {
  const [grades, setGrades] = useState<AdminGrade[]>([])
  const [policy, setPolicy] = useState<GradePolicyForm | null>(null)
  const [draft, setDraft] = useState<DraftGrade | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const result = await listGrades()
    if (result.error) setError(result.error)
    else {
      setGrades(result.grades ?? [])
      setPolicy(result.policy ?? null)
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  function flash(text: string) {
    setMessage(text)
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleSaveDraft() {
    if (!draft) return
    setSaving(true)
    setError(null)
    const result = await saveGrade({
      id: draft.id,
      name: draft.name,
      min_total: Number(draft.min_total.replace(/[^\d-]/g, '')),
      discount_percent: Number(draft.discount_percent.replace(/[^\d.-]/g, '')),
      color: draft.color,
      sort_order: Number(draft.sort_order.replace(/[^\d-]/g, '')),
      is_active: draft.is_active,
    })
    if (result.error) setError(result.error)
    else {
      setDraft(null)
      flash('✅ گرید ذخیره شد')
      await refresh()
    }
    setSaving(false)
  }

  async function handleDelete(g: AdminGrade) {
    if (!window.confirm(`گرید «${g.name}» حذف شود؟`)) return
    setSaving(true)
    setError(null)
    const result = await deleteGrade(g.id)
    if (result.error) setError(result.error)
    else {
      flash('🗑️ گرید حذف شد')
      await refresh()
    }
    setSaving(false)
  }

  async function handleSavePolicy() {
    if (!policy) return
    setSaving(true)
    setError(null)
    const result = await saveGradePolicy(policy)
    if (result.error) setError(result.error)
    else flash('✅ سیاست تخفیف ذخیره شد')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1>🏆 گرید مشتریان</h1>
            <p className="admin-subtitle">در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-main payment-settings-page">
      <div className="admin-header">
        <div>
          <h1>🏆 گرید مشتریان</h1>
          <p className="admin-subtitle">
            وفاداری بر اساس مجموع خرید؛ ارتقا بعد از هر سفارش تحویل‌شده خودکار است (فقط به بالا)
          </p>
        </div>
        <Link href="/admin/settings" className="btn">← تنظیمات</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">❌ {error}</div>}

      {/* ───── سیاست تخفیف ───── */}
      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">⚖️</div>
          <div>
            <h2 className="payment-section-title">سیاست تخفیف باشگاه × گرید</h2>
            <p className="payment-section-hint">
              وقتی مشتری هم عضو باشگاه باشد هم گرید داشته باشد، فقط یکی (یا هر دو با سقف) اعمال می‌شود
            </p>
          </div>
        </div>

        {policy && (
          <>
            {(['max', 'membership_first', 'grade_first', 'stacked'] as DiscountPolicy[]).map((p) => (
              <label
                key={p}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', marginTop: '8px', borderRadius: '10px',
                  border: `1.5px solid ${policy.discount_policy === p ? '#8a5a24' : '#e5e0da'}`,
                  background: policy.discount_policy === p ? '#fdf6e3' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="discount-policy"
                  checked={policy.discount_policy === p}
                  onChange={() => setPolicy({ ...policy, discount_policy: p })}
                  style={{ marginTop: '4px' }}
                />
                <span>
                  <strong style={{ fontSize: '13px' }}>{DISCOUNT_POLICY_LABELS[p]}</strong>
                  <small style={{ display: 'block', color: '#766f64', fontSize: '11.5px' }}>
                    {POLICY_HINTS[p]}
                  </small>
                </span>
              </label>
            ))}

            <div className="field" style={{ marginTop: '14px' }}>
              <label>سقف تخفیف تجمیعی (درصد)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={policy.grade_stack_cap}
                onChange={(e) => setPolicy({ ...policy, grade_stack_cap: Number(e.target.value) })}
                disabled={saving}
              />
              <small>فقط برای سیاست «تجمیعی»: جمع دو تخفیف از این درصد بیشتر نمی‌رود</small>
            </div>

            <div className="payment-save-bar">
              <button type="button" className="btn primary-btn" onClick={handleSavePolicy} disabled={saving}>
                {saving ? '...' : '💾 ذخیره سیاست'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ───── لیست گریدها ───── */}
      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">🎯</div>
          <div>
            <h2 className="payment-section-title">گریدها ({grades.length.toLocaleString('fa-IR')})</h2>
            <p className="payment-section-hint">
              ترتیب بالاتر = گرید بالاتر؛ کف مجموع خرید به تومان است
            </p>
          </div>
        </div>

        {grades.length === 0 && (
          <p className="empty-admin">هنوز گریدی ثبت نشده است.</p>
        )}

        {grades.map((g) => (
          <div
            key={g.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '10px 12px', marginTop: '8px', borderRadius: '10px',
              border: '1px solid #e5e0da', background: '#fff',
              opacity: g.is_active ? 1 : 0.55,
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: g.color ?? '#6b4f3a', flex: '0 0 auto' }} />
            <strong style={{ fontSize: '13px', minWidth: '70px' }}>
              {g.name}
              {!g.is_active && <small style={{ color: '#9b3c32' }}> (غیرفعال)</small>}
            </strong>
            <small style={{ color: '#766f64', fontSize: '11.5px' }}>
              از {formatPrice(g.min_total)} تومان · {formatPrice(g.discount_percent)}٪ تخفیف · ترتیب {formatPrice(g.sort_order)}
            </small>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn"
              onClick={() =>
                setDraft({
                  id: g.id,
                  name: g.name,
                  min_total: String(g.min_total),
                  discount_percent: String(g.discount_percent),
                  color: g.color ?? '#6b4f3a',
                  sort_order: String(g.sort_order),
                  is_active: g.is_active,
                })
              }
              disabled={saving}
            >
              ✏️ ویرایش
            </button>
            <button type="button" className="btn btn-cancel" onClick={() => handleDelete(g)} disabled={saving}>
              🗑️
            </button>
          </div>
        ))}

        {/* فرم افزودن/ویرایش */}
        {draft ? (
          <div style={{ marginTop: '14px', padding: '12px', border: '1.5px solid #d8d0c4', borderRadius: '10px', background: '#fbf9f5' }}>
            <strong style={{ fontSize: '13px' }}>
              {draft.id ? `✏️ ویرایش «${draft.name}»` : '➕ گرید جدید'}
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginTop: '10px' }}>
              <div className="field">
                <label>نام گرید</label>
                <input value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field">
                <label>کف مجموع خرید (تومان)</label>
                <input type="number" min="0" value={draft.min_total} onChange={(e) => setDraft({ ...draft, min_total: e.target.value })} />
              </div>
              <div className="field">
                <label>درصد تخفیف</label>
                <input type="number" min="0" max="100" step="0.5" value={draft.discount_percent} onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })} />
              </div>
              <div className="field">
                <label>رنگ (HEX)</label>
                <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ height: '38px' }} />
              </div>
              <div className="field">
                <label>ترتیب نمایش</label>
                <input type="number" min="0" max="999" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} />
              </div>
              <div className="field">
                <label>وضعیت</label>
                <select value={draft.is_active ? '1' : '0'} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === '1' })}>
                  <option value="1">فعال</option>
                  <option value="0">غیرفعال</option>
                </select>
              </div>
            </div>
            <div className="payment-save-bar">
              <button type="button" className="btn primary-btn" onClick={handleSaveDraft} disabled={saving}>
                {saving ? '...' : '💾 ذخیره گرید'}
              </button>
              <button type="button" className="btn" onClick={() => setDraft(null)} disabled={saving}>
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <div className="payment-save-bar">
            <button type="button" className="btn primary-btn" onClick={() => setDraft({ ...EMPTY_DRAFT })} disabled={saving}>
              ➕ افزودن گرید
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
