'use client'

import { useMemo, useState } from 'react'
import { createManualJournal } from '@/app/admin/accounting/actions'
import { toEnDigits } from '@/lib/wallet/charge'

// 🎯 پچ ۵۳-ب — ادیتور سند حسابداری چندردیفه (داخل مودال مشترک):
// الگوی Xero/QuickBooks: جدول ردیف‌ها با ستون‌های بدهکار/بستانکار + شرح هر ردیف +
// کنترل توازن زنده؛ الگوی سپیدار/هلو: گزارش با ستون‌های بدهکار/بستانکار
// برای مدیرانِ سندگریز: قالب‌های آماده که فقط حساب و مبلغ را می‌پرسند

export type Acc = {
  id: string
  name: string
  kind: string
  treasury_type: string | null
}

type RowState = { desc: string; acc: string; debit: string; credit: string }

const TRE_ICON: Record<string, string> = {
  cash: '💵',
  card_reader: '🖥',
  online: '🌐',
  transfer: '🔁',
  bank: '🏦',
}

export function accLabel(a: Acc): string {
  const icon = TRE_ICON[a.treasury_type ?? ''] || ''
  const prefix =
    a.kind === 'expense' ? '📤 ' : a.kind === 'income' ? '📥 ' : ''
  return `${icon}${prefix}${a.name}`
}

const inputStyle: React.CSSProperties = {
  fontSize: 12.5,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #d8d0c4',
  font: 'inherit',
  color: '#4b443b',
  background: '#fff',
  width: '100%',
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

function parseNum(s: string): number {
  const n = Math.floor(Number(toEnDigits(s).replace(/[^\d]/g, '')))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const TEMPLATES = [
  {
    key: 'pay',
    label: '📤 پرداخت هزینه',
    hint: 'هزینه از خزانه — مثلاً اجاره، مواد اولیه',
    color: '#9b3c32',
  },
  {
    key: 'receive',
    label: '📥 دریافت',
    hint: 'سرمایه/درآمد به خزانه',
    color: '#2d5d3e',
  },
  {
    key: 'transfer',
    label: '🔁 انتقال بین حساب‌ها',
    hint: 'مثلاً تسویهٔ کارت‌خوان به بانک',
    color: '#9a6b3f',
  },
  {
    key: 'blank',
    label: '📄 سند خالی',
    hint: 'خودت ردیف‌ها را می‌سازی',
    color: '#4a7fa5',
  },
] as const

export default function TreasuryJournalEditor({
  treasury,
  income,
  expense,
  onDone,
}: {
  treasury: Acc[]
  income: Acc[]
  expense: Acc[]
  onDone: () => void
}) {
  const firstT = treasury[0]?.id ?? ''
  const secondT = treasury[1]?.id ?? treasury[0]?.id ?? ''
  const [entryDesc, setEntryDesc] = useState('')
  const [rows, setRows] = useState<RowState[]>([
    { desc: '', acc: firstT, debit: '', credit: '' },
    { desc: '', acc: secondT, debit: '', credit: '' },
  ])
  const [busy, setBusy] = useState(false)

  const applyTemplate = (key: 'pay' | 'receive' | 'transfer' | 'blank') => {
    if (key === 'pay') {
      setRows([
        { desc: '', acc: expense[0]?.id ?? '', debit: '', credit: '' },
        { desc: '', acc: firstT, debit: '', credit: '' },
      ])
      setEntryDesc('پرداخت هزینه')
    } else if (key === 'receive') {
      setRows([
        { desc: '', acc: firstT, debit: '', credit: '' },
        { desc: '', acc: income[0]?.id ?? '', debit: '', credit: '' },
      ])
      setEntryDesc('دریافت')
    } else if (key === 'transfer') {
      setRows([
        { desc: '', acc: secondT, debit: '', credit: '' },
        { desc: '', acc: firstT, debit: '', credit: '' },
      ])
      setEntryDesc('انتقال بین حساب‌ها')
    } else {
      setRows([
        { desc: '', acc: '', debit: '', credit: '' },
        { desc: '', acc: '', debit: '', credit: '' },
      ])
      setEntryDesc('')
    }
  }

  const setRow = (i: number, patch: Partial<RowState>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows((prev) => [...prev, { desc: '', acc: '', debit: '', credit: '' }])

  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev))

  // کنترل توازن زنده — مثل نرم‌افزارهای حسابداری
  const sumDebit = useMemo(
    () => rows.reduce((s, r) => s + parseNum(r.debit), 0),
    [rows]
  )
  const sumCredit = useMemo(
    () => rows.reduce((s, r) => s + parseNum(r.credit), 0),
    [rows]
  )
  const rowsValid = useMemo(
    () =>
      rows.filter((r) => parseNum(r.debit) + parseNum(r.credit) > 0).every(
        (r) =>
          r.acc &&
          ((parseNum(r.debit) > 0 && !parseNum(r.credit)) ||
            (parseNum(r.credit) > 0 && !parseNum(r.debit)))
      ),
    [rows]
  )
  const balanced =
    sumDebit > 0 && sumDebit === sumCredit && rowsValid && rows.length >= 2

  const accountSelect = (
    value: string,
    onChange: (v: string) => void
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
      disabled={busy}
    >
      <option value="" disabled>
        انتخاب حساب…
      </option>
      <optgroup label="💰 خزانه">
        {treasury.map((a) => (
          <option key={a.id} value={a.id}>
            {accLabel(a)}
          </option>
        ))}
      </optgroup>
      <optgroup label="📥 درآمد">
        {income.map((a) => (
          <option key={a.id} value={a.id}>
            {accLabel(a)}
          </option>
        ))}
      </optgroup>
      <optgroup label="📤 هزینه">
        {expense.map((a) => (
          <option key={a.id} value={a.id}>
            {accLabel(a)}
          </option>
        ))}
      </optgroup>
    </select>
  )

  const submit = async () => {
    if (!balanced || busy) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('entry_desc', entryDesc)
      rows.forEach((r, i) => {
        fd.set(`line_acc_${i}`, r.acc)
        fd.set(`line_desc_${i}`, r.desc)
        fd.set(`line_debit_${i}`, r.debit)
        fd.set(`line_credit_${i}`, r.credit)
      })
      await createManualJournal(fd)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const diff = sumDebit - sumCredit

  return (
    <div>
      {/* قالب‌های آماده */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => applyTemplate(t.key)}
            disabled={busy}
            title={t.hint}
            style={{
              border: '1px solid ' + t.color,
              background: '#fff',
              color: t.color,
              borderRadius: 999,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* شرح کلی سند */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 700,
            display: 'block',
            marginBottom: 4,
            color: '#766f64',
          }}
        >
          شرح سند (اختیاری):
        </label>
        <input
          type="text"
          value={entryDesc}
          onChange={(e) => setEntryDesc(e.target.value)}
          placeholder="مثلاً هزینه‌های آبان — اجاره و برق"
          disabled={busy}
          style={inputStyle}
        />
      </div>

      {/* جدول ردیف‌ها — بدهکار / بستانکار */}
      <div style={{ overflowX: 'auto', marginBottom: 4 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 520,
            fontSize: 12.5,
          }}
        >
          <thead>
            <tr style={{ background: '#f4efe6' }}>
              <th
                style={{
                  padding: '6px 8px',
                  textAlign: 'right',
                  fontWeight: 800,
                  color: '#766f64',
                  fontSize: 11.5,
                }}
              >
                شرح ردیف
              </th>
              <th
                style={{
                  padding: '6px 8px',
                  textAlign: 'right',
                  fontWeight: 800,
                  color: '#766f64',
                  fontSize: 11.5,
                  minWidth: 170,
                }}
              >
                حساب
              </th>
              <th
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#2d5d3e',
                  fontSize: 11.5,
                  width: 110,
                }}
              >
                بدهکار
              </th>
              <th
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#9b3c32',
                  fontSize: 11.5,
                  width: 110,
                }}
              >
                بستانکار
              </th>
              <th style={{ width: 34 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid #eee7db' }}>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    value={r.desc}
                    onChange={(e) => setRow(i, { desc: e.target.value })}
                    placeholder="شرح این ردیف…"
                    disabled={busy}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  {accountSelect(r.acc, (v) => setRow(i, { acc: v }))}
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={r.debit}
                    onChange={(e) => {
                      setRow(i, { debit: toEnDigits(e.target.value), credit: '' })
                    }}
                    placeholder="0"
                    dir="ltr"
                    disabled={busy}
                    style={{ ...inputStyle, textAlign: 'center', color: '#2d5d3e' }}
                  />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={r.credit}
                    onChange={(e) => {
                      setRow(i, { credit: toEnDigits(e.target.value), debit: '' })
                    }}
                    placeholder="0"
                    dir="ltr"
                    disabled={busy}
                    style={{ ...inputStyle, textAlign: 'center', color: '#9b3c32' }}
                  />
                </td>
                <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                  {rows.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={busy}
                      title="حذف ردیف"
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#9b3c32',
                        fontSize: 13,
                        font: 'inherit',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #d8d0c4' }}>
              <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 800 }}>
                جمع
              </td>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#2d5d3e',
                }}
              >
                {fa(sumDebit)}
              </td>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#9b3c32',
                }}
              >
                {fa(sumCredit)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <button
          type="button"
          onClick={addRow}
          disabled={busy}
          style={{
            border: '1px dashed #4a7fa5',
            background: '#fff',
            color: '#4a7fa5',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          ➕ ردیف
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            borderRadius: 999,
            padding: '4px 12px',
            background: balanced ? '#e8f3ec' : '#fdeaea',
            color: balanced ? '#2d5d3e' : '#9b3c32',
          }}
        >
          {balanced
            ? `⚖️ متوازن — جمع ${fa(sumDebit)} تومان`
            : sumDebit + sumCredit === 0
              ? '⚖️ مبالغ را وارد کن'
              : `⚠️ عدم توازن: ${fa(Math.abs(diff))} تومان ${diff > 0 ? 'بستانکار کم است' : 'بدهکار کم است'}`}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!balanced || busy}
          className="btn"
          style={{
            fontSize: 12.5,
            background: balanced ? '#2d5d3e' : '#c9c2b6',
            color: '#fff',
            borderColor: balanced ? '#2d5d3e' : '#c9c2b6',
            marginInlineStart: 'auto',
          }}
        >
          {busy ? '⏳ در حال ثبت…' : '✓ ثبت سند'}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: '#8a8378', marginTop: 8 }}>
        چند عملیات مرتبط را می‌توانی در یک سند ثبت کنی — مثلاً اجاره + برق + حقوق
        هر کدام یک ردیف با شرح خودش. هر ردیف فقط بدهکار یا بستانکار می‌گیرد و جمع
        دو ستون باید برابر شود (سند متوازن).
      </p>
    </div>
  )
}
