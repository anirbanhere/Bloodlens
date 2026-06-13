import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import TrendChart, { type TrendPoint } from '@/components/TrendChart'
import { type MarkerStatus } from '@/lib/status'
import Card from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function MarkerDetailPage({
  params,
}: {
  params: Promise<{ id: string; key: string }>
}) {
  const { id, key } = await params
  const [patient, definition, results] = await Promise.all([
    prisma.patient.findUnique({ where: { id } }),
    prisma.markerDefinition.findUnique({ where: { markerKey: key } }),
    prisma.markerResult.findMany({
      where: { patientId: id, markerKey: key },
      include: { report: { select: { id: true, reportDate: true, labName: true } } },
    }),
  ])
  if (!patient || !definition) notFound()

  const sorted = [...results].sort((a, b) =>
    a.report.reportDate.localeCompare(b.report.reportDate)
  )
  const points: TrendPoint[] = sorted.map((r) => ({
    date: r.report.reportDate,
    value: r.value,
    valueText: r.valueText,
    lab: r.report.labName,
    reportId: r.reportId,
  }))

  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  const change =
    latest?.value != null && previous?.value != null ? latest.value - previous.value : null
  const isOrdinal = definition.valueType === 'ordinal'
  // Use the most recent recorded reference range for the band
  const withRange = [...sorted].reverse().find((r) => r.referenceLow != null && r.referenceHigh != null)

  return (
    <div>
      <p className="text-sm text-slate-500 mb-1">
        <Link href={`/patients/${id}`} className="text-brand-600 hover:underline">{patient.name}</Link>
        {' · '}
        <Link href={`/patients/${id}/table`} className="text-brand-600 hover:underline">Marker table</Link>
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">{definition.canonicalName}</h1>
      <p className="text-sm text-slate-500 mb-6">{definition.category}</p>

      {points.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          No values recorded for this marker yet.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="p-4">
              <p className="text-xs text-slate-400">Latest ({latest.report.reportDate})</p>
              <p className="text-xl font-semibold text-slate-800 mt-1 tabular-nums">
                {latest.valueText ?? latest.value} <span className="text-sm font-normal text-slate-400">{latest.unit}</span>
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-400">Previous</p>
              <p className="text-xl font-semibold text-slate-800 mt-1 tabular-nums">
                {previous ? (previous.valueText ?? previous.value) : '—'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-400">Change</p>
              <p className="text-xl font-semibold text-slate-800 mt-1 tabular-nums">
                {change == null ? '—' : `${change > 0 ? '+' : ''}${Number(change.toFixed(2))}`}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-400 mb-2">Status</p>
              <StatusBadge status={(latest.status as MarkerStatus) ?? 'unknown'} />
            </Card>
          </div>

          <TrendChart
            points={points}
            unit={latest.unit}
            referenceLow={withRange?.referenceLow ?? null}
            referenceHigh={withRange?.referenceHigh ?? null}
            ordinal={isOrdinal}
          />

          <h2 className="font-semibold text-slate-700 mt-8 mb-3">History</h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Lab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...sorted].reverse().map((r) => (
                  <tr key={r.id} className="even:bg-slate-50/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/reports/${r.reportId}`} className="text-brand-600 hover:underline">
                        {r.report.reportDate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {r.valueText ?? r.value} <span className="text-slate-400 font-normal">{r.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {r.referenceLow != null || r.referenceHigh != null
                        ? `${r.referenceLow ?? '·'} – ${r.referenceHigh ?? '·'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={(r.status as MarkerStatus) ?? 'unknown'} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.report.labName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
