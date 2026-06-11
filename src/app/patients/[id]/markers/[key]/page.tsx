import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import TrendChart, { type TrendPoint } from '@/components/TrendChart'
import { STATUS_LABELS, STATUS_CLASSES, type MarkerStatus } from '@/lib/status'

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
    lab: r.report.labName,
    reportId: r.reportId,
  }))

  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  const change = latest && previous ? latest.value - previous.value : null
  // Use the most recent recorded reference range for the band
  const withRange = [...sorted].reverse().find((r) => r.referenceLow != null && r.referenceHigh != null)

  return (
    <div>
      <p className="text-sm text-slate-500 mb-1">
        <Link href={`/patients/${id}`} className="text-blue-600 hover:underline">{patient.name}</Link>
        {' · '}
        <Link href={`/patients/${id}/table`} className="text-blue-600 hover:underline">Marker table</Link>
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{definition.canonicalName}</h1>
      <p className="text-sm text-slate-500 mb-6">{definition.category}</p>

      {points.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No values recorded for this marker yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Latest ({latest.report.reportDate})</p>
              <p className="text-xl font-semibold text-slate-800 mt-1 tabular-nums">
                {latest.value} <span className="text-sm font-normal text-slate-400">{latest.unit}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Previous</p>
              <p className="text-xl font-semibold text-slate-800 mt-1 tabular-nums">
                {previous ? previous.value : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Change</p>
              <p className="text-xl font-semibold text-slate-800 mt-1 tabular-nums">
                {change == null ? '—' : `${change > 0 ? '+' : ''}${Number(change.toFixed(2))}`}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Status</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full border mt-2 ${STATUS_CLASSES[(latest.status as MarkerStatus) ?? 'unknown']}`}>
                {STATUS_LABELS[(latest.status as MarkerStatus) ?? 'unknown']}
              </span>
            </div>
          </div>

          <TrendChart
            points={points}
            unit={latest.unit}
            referenceLow={withRange?.referenceLow ?? null}
            referenceHigh={withRange?.referenceHigh ?? null}
          />

          <h2 className="font-semibold text-slate-700 mt-8 mb-3">History</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Lab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...sorted].reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/reports/${r.reportId}`} className="text-blue-600 hover:underline">
                        {r.report.reportDate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {r.value} <span className="text-slate-400 font-normal">{r.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {r.referenceLow != null || r.referenceHigh != null
                        ? `${r.referenceLow ?? '·'} – ${r.referenceHigh ?? '·'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${STATUS_CLASSES[(r.status as MarkerStatus) ?? 'unknown']}`}>
                        {STATUS_LABELS[(r.status as MarkerStatus) ?? 'unknown']}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.report.labName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
