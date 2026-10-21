'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import DatePicker from 'react-multi-date-picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'

type Organization = {
  id: string; name: string; discount_percent: number; max_daily_orders: number; max_total_orders: number; expires_at: string; is_active: boolean
}

const toLatinDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

export default function MembershipsManager({ initialOrgs }: { initialOrgs: Organization[] }) {
  const router = useRouter()
  
  // فرم آپلود
  const [step, setStep] = useState(1)
  const [editableData, setEditableData] = useState<any[]>([])
  const [orgName, setOrgName] = useState('دانشکده داروسازی شیراز')
  const [discount, setDiscount] = useState(10)
  const [maxDaily, setMaxDaily] = useState(2)
  const [maxTotal, setMaxTotal] = useState(1000)
  const [expiresAt, setExpiresAt] = useState<any>(null)

  // استیت‌های عمومی
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // مودال مشاهده اعضا
  const [membersList, setMembersList] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedOrgName, setSelectedOrgName] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')

  // مودال ویرایش سازمان
  const [showEditModal, setShowEditModal] = useState(false)
  const [editOrg, setEditOrg] = useState<Organization | null>(null)

  // درخواست‌ها
  const [requests, setRequests] = useState<any[]>([])
  const [reqLoading, setReqLoading] = useState<string | null>(null)

  // ✅ استیت‌های جدید برای ویرایش قوانین
  const [rulesGeneral, setRulesGeneral] = useState('')
  const [rulesOrg, setRulesOrg] = useState('')
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesMsg, setRulesMsg] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
    fetchRules()
  }, [])

  const fetchRequests = () => {
    fetch('/api/admin/memberships/requests')
      .then(res => res.json())
      .then(data => { if (data.requests) setRequests(data.requests) })
      .catch(() => {})
  }

  const fetchRules = () => {
    fetch('/api/admin/memberships/rules')
      .then(res => res.json())
      .then(data => {
        if (data.membership_rules_general) setRulesGeneral(data.membership_rules_general)
        if (data.membership_rules_org) setRulesOrg(data.membership_rules_org)
      })
      .catch(() => {})
  }

  const handleSaveRules = async () => {
    setRulesLoading(true); setRulesMsg(null)
    try {
      const res = await fetch('/api/admin/memberships/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ general: rulesGeneral, org: rulesOrg })
      })
      if (!res.ok) throw new Error('خطا در ذخیره قوانین')
      setRulesMsg('✅ قوانین با موفقیت ذخیره شد')
      setTimeout(() => setRulesMsg(null), 3000)
    } catch (err: any) {
      setRulesMsg(`❌ ${err.message}`)
    } finally {
      setRulesLoading(false)
    }
  }

  const handleRequestAction = async (reqId: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !confirm('آیا از رد این درخواست مطمئنید؟')) return
    setReqLoading(reqId + action)
    try {
      const res = await fetch(`/api/admin/memberships/requests/${reqId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      alert(data.message)
      fetchRequests()
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setReqLoading(null)
    }
  }

  // --- بقیه توابع آپلود و ویرایش ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!expiresAt) { setError('لطفاً ابتدا تاریخ انقضا را مشخص کنید.'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(ws) as any[]
        const mappedData = rawData.map(row => {
          const nameKey = Object.keys(row).find(k => k.includes('نام') || k.toLowerCase().includes('name'))
          const idKey = Object.keys(row).find(k => k.includes('دانشجو') || k.includes('پرسنلی') || k.includes('کد') || k.toLowerCase().includes('id'))
          const phoneKey = Object.keys(row).find(k => k.includes('تلفن') || k.includes('موبایل') || k.toLowerCase().includes('phone'))
          return { name: nameKey ? String(row[nameKey] || '') : '', memberId: idKey ? String(row[idKey] || '') : '', phone: phoneKey ? String(row[phoneKey] || '') : '' }
        }).filter(r => r.name || r.memberId)
        setEditableData(mappedData); setStep(2); setError(null)
      } catch { setError('خطا در خواندن فایل اکسل.') }
    }
    reader.readAsBinaryString(file)
  }

  const handleCellChange = (index: number, field: string, value: string) => {
    const newData = [...editableData]; newData[index][field] = value; setEditableData(newData)
  }

  const handleRemoveRow = (index: number) => { setEditableData(editableData.filter((_, i) => i !== index)) }

  const handleSubmit = async () => {
    setLoading(true); setError(null); setMessage(null)
    try {
      const gregorianDate = expiresAt ? expiresAt.toDate().toISOString() : null
      const res = await fetch('/api/admin/memberships/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, discount, maxDaily, maxTotal, expiresAt: gregorianDate, members: editableData.map(d => ({ full_name: d.name, member_id: d.memberId, phone: d.phone })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage(data.message); setStep(1); setEditableData([]); setExpiresAt(null); router.refresh()
    } catch (err: any) { setError(err.message || 'خطا در ثبت') } finally { setLoading(false) }
  }

  const handleViewMembers = async (orgId: string, name: string) => {
    setSelectedOrgId(orgId); setSelectedOrgName(name); setShowMembersModal(true); setMembersLoading(true); setMembersError(null); setMembersList([])
    try {
      const res = await fetch(`/api/admin/memberships/${orgId}/members`)
      const text = await res.text(); let data;
      try { data = JSON.parse(text) } catch { throw new Error('خطای سرور: پاسخ HTML دریافت شد.') }
      if (!res.ok) throw new Error(data.error)
      setMembersList(data.members || [])
    } catch (err: any) { setMembersError(err.message) } finally { setMembersLoading(false) }
  }

  const handleEditOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editOrg) return; setLoading(true)
    try {
      const res = await fetch(`/api/admin/memberships/${editOrg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editOrg) })
      if (!res.ok) throw new Error('خطا در ویرایش')
      setShowEditModal(false); router.refresh(); alert('✅ تنظیمات ذخیره شد')
    } catch (err: any) { alert(err.message) } finally { setLoading(false) }
  }

  const handleDeleteOrg = async () => {
    if (!editOrg) return
    const confirmText = prompt(`برای حذف کامل «${editOrg.name}»، کلمه DELETE را تایپ کنید:`)
    if (confirmText !== 'DELETE') return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/memberships/${editOrg.id}`, { method: 'DELETE' })
      const data = await res.json(); if (!res.ok) throw new Error(data.error)
      setShowEditModal(false); router.refresh(); alert('✅ سازمان حذف شد')
    } catch (err: any) { alert(err.message) } finally { setLoading(false) }
  }

  const tableInputStyle = { width: '100%', padding: '8px', border: '1px solid #d8d0c4', borderRadius: '6px', background: '#fffdf9', outline: 'none', fontFamily: 'inherit', fontSize: '13px' }

  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* داشبورد آماری */}
      <div className="stats-grid" style={{ marginBottom: '10px' }}>
        <div className="stat-card"><div className="stat-icon" style={{ background: '#f5f0e9', color: '#6b4f3a' }}>🏢</div><div className="stat-content"><div className="stat-value">{initialOrgs.length.toLocaleString('fa-IR')}</div><div className="stat-label">کل سازمان‌ها</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background: '#e5f0e6', color: '#2d5d3e' }}>✅</div><div className="stat-content"><div className="stat-value">{initialOrgs.filter(o => o.is_active).length.toLocaleString('fa-IR')}</div><div className="stat-label">سازمان‌های فعال</div></div></div>
        <div className="stat-card" style={{ borderColor: requests.length > 0 ? '#9b3c32' : undefined }}><div className="stat-icon" style={{ background: requests.length > 0 ? '#fde8e6' : '#eee9e4', color: requests.length > 0 ? '#9b3c32' : '#766f64' }}>⚠️</div><div className="stat-content"><div className="stat-value" style={{ color: requests.length > 0 ? '#9b3c32' : undefined }}>{requests.length.toLocaleString('fa-IR')}</div><div className="stat-label">درخواست بررسی دستی</div></div></div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #ebe6de' }} />

      {/* ✅ بخش جدید: ویرایش قوانین */}
      <div>
        <h2 className="card-title" style={{ marginBottom: '16px' }}>📜 ویرایش قوانین باشگاه</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field">
            <label>قوانین باشگاه مشتریان عادی</label>
            <textarea value={rulesGeneral} onChange={(e) => setRulesGeneral(e.target.value)} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d8d0c4', background: '#fffdf9', fontFamily: 'inherit', fontSize: '13px' }} />
          </div>
          <div className="field">
            <label>قوانین تخفیف سازمانی</label>
            <textarea value={rulesOrg} onChange={(e) => setRulesOrg(e.target.value)} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d8d0c4', background: '#fffdf9', fontFamily: 'inherit', fontSize: '13px' }} />
          </div>
          <div>
            <button type="button" className="btn primary-btn" onClick={handleSaveRules} disabled={rulesLoading} style={{ minWidth: '150px' }}>
              {rulesLoading ? 'در حال ذخیره...' : '💾 ذخیره قوانین'}
            </button>
            {rulesMsg && <span style={{ marginInlineStart: '12px', fontSize: '13px', color: rulesMsg.includes('✅') ? '#2d5d3e' : '#9b3c32', fontWeight: 'bold' }}>{rulesMsg}</span>}
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #ebe6de' }} />

      {/* بخش آپلود و ویرایش اکسل */}
      <div>
        <h2 className="card-title" style={{ marginBottom: '16px' }}>📤 آپلود لیست جدید</h2>
        {step === 1 && (
          <div className="form-grid">
            <div className="field"><label>نام سازمان / دانشگاه *</label><input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
            <div className="field"><label>تاریخ انقضای قرارداد *</label><DatePicker value={expiresAt} onChange={setExpiresAt} calendar={persian} locale={persian_fa} calendarPosition="bottom-right" inputClass="field" style={{ width: '100%' }} /></div>
            <div className="field"><label>درصد تخفیف (٪)</label><input type="text" dir="ltr" value={discount} onChange={(e) => setDiscount(Number(toLatinDigits(e.target.value).replace(/\D/g, '')))} /></div>
            <div className="field"><label>سقف سفارش در روز</label><input type="text" dir="ltr" value={maxDaily} onChange={(e) => setMaxDaily(Number(toLatinDigits(e.target.value).replace(/\D/g, '')))} /></div>
            <div className="field"><label>سقف کل سفارشات</label><input type="text" dir="ltr" value={maxTotal} onChange={(e) => setMaxTotal(Number(toLatinDigits(e.target.value).replace(/\D/g, '')))} /></div>
            <div className="field field-wide" style={{ marginTop: '16px' }}><label>فایل اکسل (Excel) *</label><input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ padding: '10px', border: '1px dashed #d8d0c4', borderRadius: '9px', background: '#fbf9f5', width: '100%', cursor: 'pointer' }} /></div>
          </div>
        )}
        {step === 2 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><p style={{ fontSize: '13px', color: '#766f64' }}>فایل شامل <strong>{editableData.length}</strong> ردیف است. می‌توانید ویرایش کنید.</p><button type="button" className="btn" onClick={() => setStep(1)}>← بازگشت</button></div>
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ebe6de', borderRadius: '10px' }}>
              <table className="sales-table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fffdf9' }}><tr><th>ردیف</th><th>نام و نام خانوادگی</th><th>شماره دانشجویی/پرسنلی</th><th>شماره تلفن (اختیاری)</th><th>حذف</th></tr></thead>
                <tbody>
                  {editableData.map((row, idx) => (
                    <tr key={idx}><td>{idx + 1}</td><td><input type="text" style={tableInputStyle} value={row.name} onChange={(e) => handleCellChange(idx, 'name', e.target.value)} /></td><td><input type="text" style={tableInputStyle} value={row.memberId} onChange={(e) => handleCellChange(idx, 'memberId', e.target.value)} /></td><td><input type="text" style={tableInputStyle} value={row.phone} onChange={(e) => handleCellChange(idx, 'phone', e.target.value)} dir="ltr" /></td><td><button type="button" className="btn danger" style={{ padding: '4px 8px', minHeight: 'auto' }} onClick={() => handleRemoveRow(idx)}>✕</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '20px' }}><button type="button" className="btn primary-btn" onClick={handleSubmit} disabled={loading} style={{ width: '100%', minHeight: '48px' }}>{loading ? 'در حال ذخیره‌سازی...' : '✅ ثبت نهایی'}</button></div>
          </>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #ebe6de' }} />

      {/* سازمان‌های فعال */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px' }}>📋 سازمان‌های فعال</h3>
        {initialOrgs.length === 0 ? <p className="empty-admin">هنوز هیچ سازمانی ثبت نشده است.</p> : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="sales-table" style={{ minWidth: '800px' }}>
              <thead><tr><th>نام سازمان</th><th>تخفیف</th><th>تاریخ انقضا</th><th>وضعیت</th><th>عملیات</th></tr></thead>
              <tbody>
                {initialOrgs.map((org) => (
                  <tr key={org.id}>
                    <td><strong>{org.name}</strong></td><td>{org.discount_percent}٪</td><td dir="ltr" style={{ textAlign: 'right' }}>{new Date(org.expires_at).toLocaleDateString('fa-IR')}</td><td><span className={`status ${org.is_active ? 'active' : 'inactive'}`}>{org.is_active ? 'فعال' : 'غیرفعال'}</span></td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleViewMembers(org.id, org.name)}>👥 لیست اعضا</button>
                      <button className="btn" style={{ padding: '4px 12px', fontSize: '12px', background: '#f5f0e9' }} onClick={() => { setEditOrg(org); setShowEditModal(true) }}>✏️ تنظیمات</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #ebe6de' }} />

      {/* درخواست‌های بررسی دستی */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px', color: '#9b3c32' }}>⚠️ درخواست‌های بررسی دستی</h3>
        {requests.length === 0 ? <p className="empty-admin">هیچ درخواستی وجود ندارد.</p> : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="sales-table" style={{ minWidth: '700px' }}>
              <thead><tr><th>نام وارد شده</th><th>شماره تلفن</th><th>کد وارد شده</th><th>سازمان</th><th>عملیات</th></tr></thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td>{req.full_name}</td><td dir="ltr" style={{ textAlign: 'right' }}>{req.phone}</td><td>{req.member_id}</td><td>{req.organization_name}</td>
                    <td style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn primary-btn" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto' }} onClick={() => handleRequestAction(req.id, 'approve')} disabled={!!reqLoading}>✅ تایید</button>
                      <button className="btn danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto' }} onClick={() => handleRequestAction(req.id, 'reject')} disabled={!!reqLoading}>❌ رد</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* مودال مشاهده اعضا */}
      {showMembersModal && (
        <div className="modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-header-content"><h2>👥 اعضای {selectedOrgName}</h2><p>تعداد کل: {membersList.length} نفر</p></div><button type="button" className="modal-close-btn" onClick={() => setShowMembersModal(false)}>✕</button></div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {membersLoading ? <p className="empty-admin">در حال بارگذاری...</p> : membersError ? <div className="admin-error">❌ {membersError}</div> : membersList.length === 0 ? <p className="empty-admin">هیچ عضوی یافت نشد.</p> : (
                <table className="sales-table" style={{ width: '100%' }}><thead><tr><th>نام</th><th>کد</th><th>وضعیت</th></tr></thead><tbody>{membersList.map((m) => (<tr key={m.id}><td>{m.metadata?._display_name || 'نامشخص'}</td><td>{m.metadata?._display_member_id || 'نامشخص'}</td><td>{m.is_registered ? <span style={{ color: '#2d5d3e', fontWeight: 700 }}>✅ ثبت‌نام کرده</span> : <span style={{ color: '#9a6b3f' }}>⏳ ثبت‌نام نکرده</span>}</td></tr>))}</tbody></table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال ویرایش تنظیمات */}
      {showEditModal && editOrg && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-header-content"><h2>✏️ ویرایش تنظیمات {editOrg.name}</h2></div><button type="button" className="modal-close-btn" onClick={() => setShowEditModal(false)}>✕</button></div>
            <div className="modal-body">
              <form onSubmit={handleEditOrgSubmit} className="form-grid">
                <div className="field"><label>درصد تخفیف (٪)</label><input type="text" dir="ltr" value={editOrg.discount_percent} onChange={(e) => setEditOrg({...editOrg, discount_percent: Number(toLatinDigits(e.target.value).replace(/\D/g, ''))})} /></div>
                <div className="field"><label>سقف سفارش در روز</label><input type="text" dir="ltr" value={editOrg.max_daily_orders} onChange={(e) => setEditOrg({...editOrg, max_daily_orders: Number(toLatinDigits(e.target.value).replace(/\D/g, ''))})} /></div>
                <div className="field"><label>سقف کل سفارشات</label><input type="text" dir="ltr" value={editOrg.max_total_orders} onChange={(e) => setEditOrg({...editOrg, max_total_orders: Number(toLatinDigits(e.target.value).replace(/\D/g, ''))})} /></div>
                <div className="field"><label>تاریخ انقضا</label><input type="date" value={editOrg.expires_at.split('T')[0]} onChange={(e) => setEditOrg({...editOrg, expires_at: e.target.value})} dir="ltr" /></div>
                <div className="field field-wide"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={editOrg.is_active} onChange={(e) => setEditOrg({...editOrg, is_active: e.target.checked})} /><span>سازمان فعال باشد</span></label></div>
                <div className="field-wide" style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn primary-btn" style={{ flex: 1 }} disabled={loading}>{loading ? '...' : '💾 ذخیره تغییرات'}</button>
                  <button type="button" className="btn danger" style={{ flex: 0.4, background: '#fde8e6', color: '#9b3c32', border: '1px solid #f2c9c5' }} onClick={handleDeleteOrg} disabled={loading}>🗑️ حذف کامل</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}