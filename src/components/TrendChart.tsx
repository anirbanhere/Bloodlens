'use client'

import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts'
import { ordinalTick } from '@/lib/qualitative'

export type TrendPoint = {
  date: string
  value: number | null
  valueText?: string | null
  lab: string | null
  reportId: string
}

export default function TrendChart({
  points, // ascending by date
  unit,
  referenceLow,
  referenceHigh,
  ordinal = false,
}: {
  points: TrendPoint[]
  unit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  ordinal?: boolean
}) {
  const router = useRouter()

  // Only points with a numeric value can be plotted.
  const numericPoints = points.filter((p) => p.value != null)
  const values = numericPoints.map((p) => p.value as number)
  if (numericPoints.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No numeric values to plot. See the history table below for recorded results.
      </div>
    )
  }

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (referenceLow != null) min = Math.min(min, referenceLow)
  if (referenceHigh != null) max = Math.max(max, referenceHigh)
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.15 || 1
  const domain: [number, number] = [Math.max(0, min - pad), max + pad]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={numericPoints}
          margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
          onClick={(state) => {
            const idx = Number(state?.activeIndex)
            const p = Number.isInteger(idx) ? numericPoints[idx] : undefined
            if (p?.reportId) router.push(`/reports/${p.reportId}`)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis
            domain={domain}
            tick={{ fontSize: 12, fill: '#64748b' }}
            width={ordinal ? 60 : 50}
            tickFormatter={ordinal ? (v: number) => ordinalTick(v) : undefined}
          />
          {referenceLow != null && referenceHigh != null && (
            <ReferenceArea
              y1={referenceLow}
              y2={referenceHigh}
              fill="#22c55e"
              fillOpacity={0.08}
              stroke="#22c55e"
              strokeOpacity={0.25}
              strokeDasharray="4 4"
            />
          )}
          <Tooltip
            formatter={(value, _name, item) => {
              const text = item?.payload?.valueText
              if (text) return [text, 'Value']
              return [`${value}${unit ? ` ${unit}` : ''}`, 'Value']
            }}
            labelFormatter={(label, payload) => {
              const lab = payload?.[0]?.payload?.lab
              return lab ? `${label} · ${lab}` : String(label)
            }}
            contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4, fill: '#2563eb', cursor: 'pointer' }}
            activeDot={{ r: 6, cursor: 'pointer' }}
          />
        </LineChart>
      </ResponsiveContainer>
      {referenceLow != null && referenceHigh != null && !ordinal && (
        <p className="text-xs text-slate-400 mt-2 px-2">
          Green band = lab reference range ({referenceLow} – {referenceHigh}
          {unit ? ` ${unit}` : ''}) · Click a dot to open that report.
        </p>
      )}
      {ordinal && (
        <p className="text-xs text-slate-400 mt-2 px-2">
          Scale: Negative · Trace · 1+ · 2+ · 3+ · 4+ · Click a dot to open that report.
        </p>
      )}
    </div>
  )
}
