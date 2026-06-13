'use client'

import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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
      <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-8 text-center text-slate-500">
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
    <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={numericPoints}
          margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
          onClick={(state) => {
            const idx = Number(state?.activeIndex)
            const p = Number.isInteger(idx) ? numericPoints[idx] : undefined
            if (p?.reportId) router.push(`/reports/${p.reportId}`)
          }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7982c9" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#7982c9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
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
              fill="#83c979"
              fillOpacity={0.1}
              stroke="#83c979"
              strokeOpacity={0.3}
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
            contentStyle={{ fontSize: 13, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(16,24,40,.08)' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill="url(#trendFill)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7982c9"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#7982c9', cursor: 'pointer' }}
            activeDot={{ r: 7, cursor: 'pointer' }}
          />
        </ComposedChart>
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
