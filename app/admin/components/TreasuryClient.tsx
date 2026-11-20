'use client'

import { useState } from 'react'
import {
  createAccount,
  deactivateAccount,
  deleteManualEntry,
  syncTreasuryAccounts,
} from '@/app/admin/treasury/actions'
import AdminModal from './AdminModal'
import TreasuryJournalEditor, { Acc, accLabel } from './TreasuryJournalEditor'

// 🎯 پچ ۵۳-ب — پوستهٔ خزانه با تب‌ها:
//   نوار مانده‌ها (همیشه بالا) → تب «📒 اسناد روزنامه» و تب «🗂 حساب‌ها و سرفصل‌ها»
//   ثبت سند = مودال مشترک با ادیتور چندردیفه بدهکار/بستانکار
//   جدول اسناد به سبک گزارش عملیات سپیدار/هلو: ستون‌های بدهکار و بستانکار

export type EntryLine = {
  side: string
  amount: number
  description: string | null
  gl_accounts: { name: string; kind: string; treasury_type: string | null } | null
}

export type EntryRow = {
  id: string
  entry_no: number
  entry_date: string
  description: string
  source: string
  created_by_name: string | null
  gl_lines: EntryLine[]
}

type Bal = { account_id: string; balance: number }

const TRE_ICON: Record<string, string> = {
  cash: '💵',
  card_reader: '🖥',
  online: '🌐',
  transfer: '🔁',
  bank: '🏦',
}

const inputStyle: React.CSSProperties = {
  fontSize: 12.5,
  padding: '6px 9px',
  borderRadius: 8,
  border: '1px solid #d8d0c4',
  font: 'inherit',
  color: '#4b443b',
  background: '#fff',
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

const cellTh: React.CSSProperties = {
  padding: '6px 8px',
  fontWeight: 800,
  fontSize: 11.5,
  color: '#766f64',
  textAlign: 'right',
}

export default function TreasuryClient({
  treasuries,
  incomes,
  expenses,
  balances,
  totalTreasury,
  entries,
  filters,
}: {
  treasuries: Acc[]
  incomes: Acc[]
  expenses: Acc[]
  balances: Record<string, number>
  totalTreasury: number
  entries: EntryRow[]
  filters: { acc?: string; from?: string; to?: string; kind?: string }
}) {
  const [tab, setTab] = useState<'entries' | 'accounts'>('entries')
  const [modalOpen, setModalOpen] = useState(false)

  const allActive = [...treasuries, ...incomes, ...expenses]

  return (
    <div>
      <h1 className="admin-page-title" style={{ marginBottom: 6 }}>
        💰 خزانه و حسابداری
      </h1>
      <p className="admin-page-sub" style={{ marginBottom: 14 }}>
        هر سند دوطرفه است: پول از حسابی (بستانکار) به حساب دیگر (بدهکار) می‌رود.
        فروش‌های POS خودکار ثبت می‌شوند؛ هزینه‌ها و انتقال‌ها را با «➕ ثبت سند» وارد کن.
      </p>

      {/* نوار مانده‌ها — همیشه بالای تب‌ها */}
      <section
        className="admin-card"
        style={{ marginBottom: 14, padding: 12 }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          {treasuries.map((a) => {
            const bal = balances[a.id] ?? 0
            return (
              <div
                key={a.id}
                style={{
                  flex: '1 1 130px',
                  minWidth: 130,
                  border: '1px solid #e3ddd2',
                  borderRadius: 10,
                  padding: '8px 11px',
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 11.5, color: '#766f64', fontWeight: 700 }}>
                  {accLabel(a)}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    marginTop: 3,
                    color: bal < 0 ? '#9b3c32' : '#2d5d3e',
                  }}
                >
                  {fa(bal)} <span style={{ fontSize: 10.5 }}>تومان</span>
                </div>
              </div>
            )
          })}
          <div
            style={{
              flex: '1 1 150px',
              minWidth: 150,
              border: '2px solid #2d5d3e',
              borderRadius: 10,
              padding: '8px 11px',
              background: '#e8f3ec',
            }}
          >
            <div style={{ fontSize: 11.5, color: '#2d5d3e', fontWeight: 800 }}>
              Σ مجموع خزانه
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
              {fa(totalTreasury)}{' '}
              <span style={{ fontSize: 10.5 }}>تومان</span>
            </div>
          </div>
        </div>
      </section>

      {/* نوار تب‌ها + دکمهٔ ثبت سند */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        {[
          { key: 'entries', label: '📒 اسناد روزنامه' },
          { key: 'accounts', label: '🗂 حساب‌ها و سرفصل‌ها' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'entries' | 'accounts')}
            style={{
              border: '1px solid ' + (tab === t.key ? '#2d5d3e' : '#d8d0c4'),
              background: tab === t.key ? '#e8f3ec' : '#fff',
              color: tab === t.key ? '#2d5d3e' : '#4b443b',
              borderRadius: 10,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setModalOpen(true)}
          className="btn"
          style={{
            fontSize: 12.5,
            background: '#2d5d3e',
            color: '#fff',
            borderColor: '#2d5d3e',
            marginInlineStart: 'auto',
          }}
        >
          ➕ ثبت سند
        </button>
      </div>

      {/* تب اسناد */}
      {tab === 'entries' && (
        <section className="admin-card">
          {/* فیلترها */}
          <form
            method="get"
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'end',
              marginBottom: 14,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                حساب
              </label>
              <select
                name="acc"
                defaultValue={filters.acc ?? ''}
                style={inputStyle}
              >
                <option value="">همه</option>
                {allActive.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accLabel(a)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                نوع
              </label>
              <select
                name="kind"
                defaultValue={filters.kind ?? ''}
                style={inputStyle}
              >
                <option value="">همه</option>
                <option value="pos">خودکار (فروش POS)</option>
                <option value="manual">دستی</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                از تاریخ
              </label>
              <input
                type="date"
                name="from"
                defaultValue={filters.from ?? ''}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                تا تاریخ
              </label>
              <input
                type="date"
                name="to"
                defaultValue={filters.to ?? ''}
                style={inputStyle}
              />
            </div>
            <button type="submit" className="btn" style={{ fontSize: 12 }}>
              🔎 فیلتر
            </button>
          </form>

          {/* اسناد — جدول حسابداری با ستون بدهکار/بستانکار */}
          {entries.map((e) => {
            const lines = e.gl_lines ?? []
            const isManual = e.source === 'manual'
            const sumD = lines
              .filter((l) => l.side === 'debit')
              .reduce((s, l) => s + l.amount, 0)
            const sumC = lines
              .filter((l) => l.side === 'credit')
              .reduce((s, l) => s + l.amount, 0)
            return (
              <div
                key={e.id}
                style={{
                  border: '1px solid #e3ddd2',
                  borderRadius: 10,
                  marginBottom: 10,
                  overflow: 'hidden',
                  background: isManual ? '#fffdf8' : '#fff',
                }}
              >
                {/* سربرگ سند */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f8f5ef',
                    borderBottom: '1px solid #eee7db',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#766f64',
                      background: '#f1ebdf',
                      borderRadius: 999,
                      padding: '2px 9px',
                    }}
                  >
                    سند #{fa(Number(e.entry_no))}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#8a8378' }}>
                    {new Date(e.entry_date).toLocaleString('fa-IR')}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: '2px 8px',
                      background: isManual ? '#fff4d9' : '#e8f3ec',
                      color: isManual ? '#9a6b3f' : '#2d5d3e',
                    }}
                  >
                    {isManual ? 'دستی — ' + (e.created_by_name ?? 'مدیر') : 'خودکار از POS'}
                  </span>
                  {isManual && (
                    <form
                      action={deleteManualEntry}
                      style={{ marginInlineStart: 'auto' }}
                    >
                      <input type="hidden" name="entry_id" value={e.id} />
                      <button
                        type="submit"
                        title="حذف سند دستی"
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#9b3c32',
                          font: 'inherit',
                        }}
                      >
                        🗑 حذف
                      </button>
                    </form>
                  )}
                </div>
                {/* شرح کلی */}
                <div
                  style={{
                    padding: '8px 12px 4px',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {e.description}
                </div>
                {/* جدول اقلام */}
                <div style={{ overflowX: 'auto', padding: '4px 12px 10px' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 480,
                      fontSize: 12.5,
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f4efe6' }}>
                        <th style={{ ...cellTh, minWidth: 180 }}>شرح ردیف</th>
                        <th style={{ ...cellTh, minWidth: 150 }}>حساب</th>
                        <th
                          style={{
                            ...cellTh,
                            textAlign: 'center',
                            color: '#2d5d3e',
                            width: 120,
                          }}
                        >
                          بدهکار
                        </th>
                        <th
                          style={{
                            ...cellTh,
                            textAlign: 'center',
                            color: '#9b3c32',
                            width: 120,
                          }}
                        >
                          بستانکار
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr
                          key={i}
                          style={{ borderTop: '1px solid #f1ebdf' }}
                        >
                          <td
                            style={{
                              padding: '5px 8px',
                              color: l.description ? '#4b443b' : '#b5ada0',
                            }}
                          >
                            {l.description || '—'}
                          </td>
                          <td style={{ padding: '5px 8px', fontWeight: 600 }}>
                            {l.gl_accounts
                              ? accLabel({
                                  id: '',
                                  name: l.gl_accounts.name,
                                  kind: l.gl_accounts.kind,
                                  treasury_type:
                                    l.gl_accounts.treasury_type ?? null,
                                })
                              : '؟'}
                          </td>
                          <td
                            style={{
                              padding: '5px 8px',
                              textAlign: 'center',
                              color: '#2d5d3e',
                              fontWeight: 700,
                            }}
                          >
                            {l.side === 'debit' ? fa(l.amount) : ''}
                          </td>
                          <td
                            style={{
                              padding: '5px 8px',
                              textAlign: 'center',
                              color: '#9b3c32',
                              fontWeight: 700,
                            }}
                          >
                            {l.side === 'credit' ? fa(l.amount) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #d8d0c4' }}>
                        <td
                          colSpan={2}
                          style={{ padding: '5px 8px', fontWeight: 800 }}
                        >
                          جمع
                        </td>
                        <td
                          style={{
                            padding: '5px 8px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#2d5d3e',
                          }}
                        >
                          {fa(sumD)}
                        </td>
                        <td
                          style={{
                            padding: '5px 8px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#9b3c32',
                          }}
                        >
                          {fa(sumC)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}
          {entries.length === 0 && (
            <p className="empty-admin">
              سندی پیدا نشد — با «➕ ثبت سند» اولین سند دستی را بزن.
            </p>
          )}
        </section>
      )}

      {/* تب حساب‌ها */}
      {tab === 'accounts' && (
        <section className="admin-card">
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            {[
              {
                choice: 'expense',
                label: 'سرفصل هزینهٔ جدید',
                ph: 'مثلاً هزینهٔ اینترنت',
                color: '#9b3c32',
              },
              {
                choice: 'income',
                label: 'سرفصل درآمد جدید',
                ph: 'مثلاً اجارهٔ فضا',
                color: '#2d5d3e',
              },
              {
                choice: 'bank',
                label: 'حساب بانکی جدید',
                ph: 'مثلاً بانک ملت — جاری ۱۲۳',
                color: '#4a7fa5',
              },
            ].map((f) => (
              <form
                key={f.choice}
                action={createAccount}
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <input type="hidden" name="choice" value={f.choice} />
                <input
                  name="name"
                  placeholder={f.ph}
                  style={{ ...inputStyle, width: 170 }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{
                    fontSize: 11.5,
                    borderColor: f.color,
                    color: f.color,
                  }}
                >
                  ➕ {f.label}
                </button>
              </form>
            ))}
            <form action={syncTreasuryAccounts}>
              <button type="submit" className="btn" style={{ fontSize: 11.5 }}>
                🔄 همگام‌سازی حساب‌ها از صندوق‌ها/کارت‌خوان‌ها
              </button>
            </form>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { list: treasuries, title: 'خزانه' },
              { list: incomes, title: 'درآمد' },
              { list: expenses, title: 'هزینه' },
            ].map((g) => (
              <div key={g.title} style={{ minWidth: 200, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#766f64',
                    marginBottom: 6,
                  }}
                >
                  {g.title} ({fa(g.list.length)})
                </div>
                {g.list.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12.5,
                      padding: '4px 0',
                      borderBottom: '1px dashed #eee7db',
                    }}
                  >
                    <span style={{ flex: 1 }}>{accLabel(a)}</span>
                    {balances[a.id] !== undefined && (
                      <span
                        style={{
                          color: (balances[a.id] ?? 0) < 0 ? '#9b3c32' : '#4b443b',
                          fontWeight: 700,
                        }}
                      >
                        {fa(balances[a.id] ?? 0)}
                      </span>
                    )}
                    <form action={deactivateAccount}>
                      <input type="hidden" name="account_id" value={a.id} />
                      <button
                        type="submit"
                        title="غیرفعال‌کردن — از انتخاب‌ها حذف می‌شود ولی تاریخچه می‌ماند"
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#9b3c32',
                          font: 'inherit',
                        }}
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* مودال مشترک ثبت سند */}
      {modalOpen && (
        <AdminModal
          title="✍️ ثبت سند حسابداری"
          onClose={() => setModalOpen(false)}
          wide
        >
          <TreasuryJournalEditor
            treasury={treasuries}
            income={incomes}
            expense={expenses}
            onDone={() => setModalOpen(false)}
          />
        </AdminModal>
      )}
    </div>
  )
}
