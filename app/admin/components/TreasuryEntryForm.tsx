'use client'

import { useState } from 'react'
import { createManualEntry } from '@/app/admin/treasury/actions'

// 🎯 پچ ۵۳ — فرم سند دستی خزانه: دریافت / پرداخت / انتقال بین حساب‌ها
// هر نوع، فیلدهای خودش را دارد؛ انتخاب‌ها شرطی رندر می‌شوند تا فقط همان‌ها submit شوند

type Acc = {
  id: string
  name: string
  treasury_type: string | null
}

const KINDS = [
  { key: 'receive', label: '📥 دریافت', color: '#2d5d3e', bg: '#e8f3ec' },
  { key: 'pay', label: '📤 پرداخت', color: '#9b3c32', bg: '#fdeaea' },
  { key: 'transfer', label: '🔁 انتقال', color: '#9a6b3f', bg: '#fff4d9' },
] as const

const TRE_ICON: Record<string, string> = {
  cash: '💵',
  card_reader: '🖥',
  online: '🌐',
  transfer: '🔁',
  bank: '🏦',
}

const selectStyle: React.CSSProperties = {
  fontSize: 12.5,
  padding: '6px 9px',
  borderRadius: 8,
  border: '1px solid #d8d0c4',
  font: 'inherit',
  color: '#4b443b',
  background: '#fff',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  display: 'block',
  marginBottom: 4,
  color: '#766f64',
}

export default function TreasuryEntryForm({
  treasury,
  income,
  expense,
}: {
  treasury: Acc[]
  income: Acc[]
  expense: Acc[]
}) {
  const [kind, setKind] = useState<'receive' | 'pay' | 'transfer'>('receive')
  const [busy, setBusy] = useState(false)

  const treOptions = (value: string, name: string) => (
    <select name={name} defaultValue={value} style={selectStyle} disabled={busy}>
      {treasury.map((t) => (
        <option key={t.id} value={t.id}>
          {TRE_ICON[t.treasury_type ?? ''] || '💰'} {t.name}
        </option>
      ))}
    </select>
  )

  const catOptions = (
    value: string,
    name: string,
    list: Acc[],
    placeholder: string
  ) => (
    <select name={name} defaultValue={value} style={selectStyle} disabled={busy}>
      <option value="" disabled>
        {placeholder}
      </option>
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )

  return (
    <form
      action={async (fd: FormData) => {
        setBusy(true)
        try {
          await createManualEntry(fd)
        } finally {
          setBusy(false)
        }
      }}
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'end',
      }}
    >
      <input type="hidden" name="kind" value={kind} />

      <div style={{ display: 'flex', gap: 6, width: '100%', marginBottom: 2 }}>
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            disabled={busy}
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              font: 'inherit',
              border: '1px solid ' + (kind === k.key ? k.color : '#d8d0c4'),
              background: kind === k.key ? k.bg : '#fff',
              color: kind === k.key ? k.color : '#4b443b',
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === 'receive' && (
        <>
          <div>
            <label style={labelStyle}>به حساب خزانه:</label>
            {treOptions(treasury[0]?.id ?? '', 'tre_to')}
          </div>
          <div>
            <label style={labelStyle}>سرفصل درآمد:</label>
            {catOptions('', 'cat', income, 'انتخاب سرفصل')}
          </div>
        </>
      )}

      {kind === 'pay' && (
        <>
          <div>
            <label style={labelStyle}>از حساب خزانه:</label>
            {treOptions(treasury[0]?.id ?? '', 'tre_from')}
          </div>
          <div>
            <label style={labelStyle}>سرفصل هزینه:</label>
            {catOptions('', 'cat', expense, 'انتخاب سرفصل')}
          </div>
        </>
      )}

      {kind === 'transfer' && (
        <>
          <div>
            <label style={labelStyle}>از حساب:</label>
            {treOptions(treasury[0]?.id ?? '', 'tre_from')}
          </div>
          <div>
            <label style={labelStyle}>به حساب:</label>
            {treOptions(
              treasury[1]?.id ?? treasury[0]?.id ?? '',
              'tre_to'
            )}
          </div>
        </>
      )}

      <div>
        <label style={labelStyle}>مبلغ (تومان):</label>
        <input
          type="text"
          inputMode="numeric"
          name="amount"
          dir="ltr"
          placeholder="0"
          disabled={busy}
          style={{ ...selectStyle, width: 130, textAlign: 'left' }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 160 }}>
        <label style={labelStyle}>یادداشت (اختیاری):</label>
        <input
          type="text"
          name="note"
          placeholder="مثلاً اجارهٔ تیرماه"
          disabled={busy}
          style={{ ...selectStyle, width: '100%' }}
        />
      </div>

      <button
        type="submit"
        className="btn"
        disabled={busy}
        style={{
          fontSize: 12.5,
          background: '#2d5d3e',
          color: '#fff',
          borderColor: '#2d5d3e',
        }}
      >
        {busy ? '⏳ در حال ثبت…' : '✓ ثبت سند'}
      </button>
    </form>
  )
}
