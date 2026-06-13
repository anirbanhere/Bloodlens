'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type TableColumn = {
  markerKey: string
  name: string
  unit: string | null
  category: string
}

export type TableRow = {
  reportId: string
  reportDate: string
  labName: string | null
  values: Record<string, { value: number | null; valueText: string | null; status: string | null }>
}

export default function MarkerTable({
  patientId,
  columns,
  rows,
}: {
  patientId: string
  columns: TableColumn[]
  rows: TableRow[] // sorted by date descending
}) {
  const [category, setCategory] = useState('')

  const categories = useMemo(
    () => [...new Set(columns.map((c) => c.category))],
    [columns]
  )
  const visible = useMemo(
    () => (category ? columns.filter((c) => c.category === category) : columns),
    [columns, category]
  )

  // rows are date-descending; previous report for row i is row i+1
  function change(rowIdx: number, key: string): string | null {
    const cur = rows[rowIdx]?.values[key]?.value
    const prev = rows[rowIdx + 1]?.values[key]?.value
    if (cur == null || prev == null) return null // numeric-only; null for text values
    const diff = cur - prev
    if (diff === 0) return '±0'
    const rounded = Math.abs(diff) < 10 ? diff.toFixed(2).replace(/\.?0+$/, '') : Math.round(diff).toString()
    return diff > 0 ? `+${rounded} ↑` : `${rounded} ↓`
  }

  function cellColor(status: string | null | undefined): string {
    if (status === 'high') return 'bg-alert-50 text-alert-700'
    if (status === 'low') return 'bg-warn-50 text-warn-700'
    if (status === 'normal') return 'text-slate-700'
    return 'text-slate-500'
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-8 text-center text-slate-500">
        No marker values yet. Add a report with marker values first.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-slate-600">Category:</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface rounded-card border border-slate-200/80 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-2.5 font-medium sticky left-0 bg-slate-50 z-10">Date</th>
              {visible.map((c) => (
                <th key={c.markerKey} className="px-4 py-2.5 font-medium whitespace-nowrap">
                  <Link
                    href={`/patients/${patientId}/markers/${c.markerKey}`}
                    className="hover:text-brand-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.unit && <span className="block font-normal text-slate-400">{c.unit}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={row.reportId} className="bg-surface even:bg-slate-50 hover:bg-brand-50 transition">
                <td className="px-4 py-2.5 sticky left-0 bg-inherit whitespace-nowrap">
                  <Link href={`/reports/${row.reportId}`} className="font-medium text-slate-700 hover:text-brand-600">
                    {row.reportDate}
                  </Link>
                  {row.labName && <span className="block text-xs text-slate-400">{row.labName}</span>}
                </td>
                {visible.map((c) => {
                  const cell = row.values[c.markerKey]
                  const delta = change(i, c.markerKey)
                  return (
                    <td key={c.markerKey} className={`px-4 py-2.5 tabular-nums ${cellColor(cell?.status)}`}>
                      {cell ? (
                        <>
                          {cell.valueText ?? cell.value}
                          {delta && <span className="block text-xs text-slate-400">{delta}</span>}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Rose = above range · Gold = below range · Click a marker name for its trend graph.
      </p>
    </div>
  )
}
