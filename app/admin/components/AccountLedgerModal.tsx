'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminModal from './AdminModal'
import { Acc, accLabel } from './TreasuryJournalEditor'

// 🎯 پچ ۵۳-ج — مودال مشترک «دفتر معین»: با کلیک روی هر کارت خزانه باز می‌شود
// ۱۰ قلم در هر صفحه + جستجوی زنده (۳۵۰ms debounce) در همهٔ ستون‌ها +
// جمع بدهکار/بستانکارِ نتیجه + ماندهٔ حساب — مثل کارت حساب در نرم‌افزارهای حسابداری

type LedgerRow = {
  id: number
  side: string
  amount: number
  description: string | null
  entry_no: number | null
  entry_date: string | null
  entry_desc: string
  source: string
  created_by_name: string | null
}

type LedgerData = {
  account: Acc
  balance: number
  page: number
  pageSize: number
  total: number
  totalPages: number
  sumDebit: number
  sumCredit: number
  rows: LedgerRow[]
}

const cellTh: React.CSSProperties = {
  padding: '6px 8px',
  fontWeight: 800,
  fontSize: 11.5,
  color: '#766f64',
  textAlign: 'right',
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

export default function AccountLedgerModal({
  account,
  balance,
  onClose,
}: {
  account: Acc
  balance: number
  onClose: () => void
}) {
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // جستجوی زنده با تاخیر — هر تغییر عبارت، به صفحهٔ ۱ برمی‌گردد
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [qInput])

  const load = useCallback(
    async (accId: string, p: number, query: string) => {
      setLoading(true)
      setErr('')
      try {
        const res = await fetch(
          `/api/admin/gl/ledger?acc=${accId}&page=${p}&q=${encodeURIComponent(query)}`,
          { cache: 'no-store' }
        )
        const j = await res.json()
        if (!res.ok) {
          setErr(j.error || 'خطا در دریافت گزارش')
          setData(null)
        } else {
          setData(j as LedgerData)
        }
      } catch {
        setErr('خطای شبکه — دوباره تلاش کن')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    load(account.id, page, q)
  }, [account, page, q, load])

  const d = data

  return (
    <AdminModal
      title={`📖 دفتر معین — ${accLabel(account)}`}
      onClose={onClose}
      wide
    >
      {/* سربرگ: مانده + جستجو */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            borderRadius: 999,
            padding: '4px 12px',
            background: balance < 0 ? '#fdeaea' : '#e8f3ec',
            color: balance < 0 ? '#9b3c32' : '#2d5d3e',
          }}
        >
          مانده: {fa(balance)} تومان
        </span>
        <input
          type="text"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="🔍 جستجو در همهٔ ستون‌ها — شرح، حساب، مبلغ، شمارهٔ سند، سازنده…"
          style={{
            flex: 1,
            minWidth: 220,
            fontSize: 12.5,
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid #d8d0c4',
            font: 'inherit',
            color: '#4b443b',
            background: '#fff',
          }}
        />
      </div>

      {loading && (
        <p style={{ fontSize: 12.5, color: '#8a8378', padding: '8px 2px' }}>
          ⏳ در حال بارگذاری…
        </p>
      )}
      {err && (
        <p style={{ fontSize: 12.5, color: '#9b3c32', fontWeight: 700 }}>
          ⚠️ {err}
        </p>
      )}

      {d && !loading && (
        <>
          {/* جدول گردش */}
          <div style={{ overflowX: 'auto', border: '1px solid #e3ddd2', borderRadius: 10 }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 620,
                fontSize: 12.5,
              }}
            >
              <thead>
                <tr style={{ background: '#f4efe6' }}>
                  <th style={{ ...cellTh, whiteSpace: 'nowrap' }}>تاریخ</th>
                  <th style={{ ...cellTh, whiteSpace: 'nowrap' }}>سند</th>
                  <th style={{ ...cellTh }}>شرح سند</th>
                  <th style={{ ...cellTh }}>شرح ردیف</th>
                  <th
                    style={{
                      ...cellTh,
                      textAlign: 'center',
                      color: '#2d5d3e',
                      width: 100,
                    }}
                  >
                    بدهکار
                  </th>
                  <th
                    style={{
                      ...cellTh,
                      textAlign: 'center',
                      color: '#9b3c32',
                      width: 100,
                    }}
                  >
                    بستانکار
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1ebdf' }}>
                    <td
                      style={{
                        padding: '5px 8px',
                        color: '#8a8378',
                        whiteSpace: 'nowrap',
                        fontSize: 11.5,
                      }}
                    >
                      {r.entry_date
                        ? new Date(r.entry_date).toLocaleString('fa-IR')
                        : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 800 }}>
                        #{fa(Number(r.entry_no ?? 0))}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: '1px 6px',
                          marginInlineStart: 5,
                          background:
                            r.source === 'manual' ? '#fff4d9' : '#e8f3ec',
                          color: r.source === 'manual' ? '#9a6b3f' : '#2d5d3e',
                        }}
                      >
                        {r.source === 'manual' ? 'دستی' : 'POS'}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', color: '#4b443b' }}>
                      {r.entry_desc || '—'}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      {r.description || (
                        <span style={{ color: '#b5ada0' }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'center',
                        color: '#2d5d3e',
                        fontWeight: 700,
                      }}
                    >
                      {r.side === 'debit' ? fa(r.amount) : ''}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'center',
                        color: '#9b3c32',
                        fontWeight: 700,
                      }}
                    >
                      {r.side === 'credit' ? fa(r.amount) : ''}
                    </td>
                  </tr>
                ))}
                {d.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, textAlign: 'center' }}>
                      <span className="empty-admin">
                        قلمی با این جستجو پیدا نشد.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #d8d0c4' }}>
                  <td
                    colSpan={4}
                    style={{ padding: '5px 8px', fontWeight: 800 }}
                  >
                    جمع نتیجه ({fa(d.total)} قلم)
                  </td>
                  <td
                    style={{
                      padding: '5px 8px',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#2d5d3e',
                    }}
                  >
                    {fa(d.sumDebit)}
                  </td>
                  <td
                    style={{
                      padding: '5px 8px',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#9b3c32',
                    }}
                  >
                    {fa(d.sumCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* صفحه‌بندی */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={d.page <= 1}
              className="btn"
              style={{ fontSize: 12, opacity: d.page <= 1 ? 0.5 : 1 }}
            >
              ← قبلی
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#766f64' }}>
              صفحهٔ {fa(d.page)} از {fa(d.totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(d.totalPages, p + 1))}
              disabled={d.page >= d.totalPages}
              className="btn"
              style={{ fontSize: 12, opacity: d.page >= d.totalPages ? 0.5 : 1 }}
            >
              بعدی →
            </button>
          </div>
        </>
      )}
    </AdminModal>
  )
}
