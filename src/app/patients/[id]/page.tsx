import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type MarkerSummary = {
  markerKey: string
  name: string
  unit: string | null
  latest: number | null
  latestText: string | null
  latestDate: string
  previous: number | null
  status: string | null
}

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [patient, results, definitions] = await Promise.all([
    prisma.patient.findUnique({
      where: { id },
      include: {
        reports: {
          orderBy: { reportDate: 'desc' },
          include: { _count: { select: { markerResults: true, reportFiles: true } } },
        },
      },
    }),
    prisma.markerResult.findMany({
      where: { patientId: id },
      include: { report: { select: { reportDate: true } } },
    }),
    prisma.markerDefinition.findMany(),
  ])
  if (!patient) notFound()

  const categoryByKey = new Map(definitions.map((d) => [d.markerKey, d.category]))

  // Latest + previous value per marker
  const byMarker = new Map<string, typeof results>()
  for (const r of results) {
    const list = byMarker.get(r.markerKey) ?? []
    list.push(r)
    byMarker.set(r.markerKey, list)
  }
  const summaries: MarkerSummary[] = [...byMarker.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.report.reportDate.localeCompare(b.report.reportDate))
    const latest = sorted[sorted.length - 1]
    const previous = sorted[sorted.length - 2]
    return {
      markerKey: key,
      name: latest.markerName,
      unit: latest.unit,
      latest: latest.value,
      latestText: latest.valueText,
      latestDate: latest.report.reportDate,
      previous: previous?.value ?? null,
      status: latest.status,
    }
  })

  // Group by category
  const byCategory = new Map<string, MarkerSummary[]>()
  for (const s of summaries) {
    const cat = categoryByKey.get(s.markerKey) ?? 'Other'
    const list = byCategory.get(cat) ?? []
    list.push(s)
    byCategory.set(cat, list)
  }
  const categories = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const latestReportDate = patient.reports[0]?.reportDate
  const outsideTotal = summaries.filter((s) => s.status === 'high' || s.status === 'low').length

  function changeBadge(s: MarkerSummary) {
    if (s.previous == null || s.latest == null) return null
    const diff = s.latest - s.previous
    if (diff === 0) return <span className="text-xs text-slate-400">stable</span>
    const txt = `${diff > 0 ? '+' : ''}${Number(diff.toFixed(2))} ${diff > 0 ? '↑' : '↓'}`
    return <span className="text-xs text-slate-500">{txt}</span>
  }

  function statusDot(status: string | null) {
    const color =
      status === 'high' ? 'bg-red-500' : status === 'low' ? 'bg-amber-500' : status === 'normal' ? 'bg-green-500' : 'bg-slate-300'
    return <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{patient.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {[patient.age ? `${patient.age} yrs` : null, patient.sex, patient.conditions]
              .filter(Boolean)
              .join(' · ') || 'No details yet'}
          </p>
          {latestReportDate && (
            <p className="text-xs text-slate-400 mt-1">
              Latest report: {latestReportDate}
              {outsideTotal > 0 && (
                <span className="ml-2 text-amber-600">· {outsideTotal} marker{outsideTotal === 1 ? '' : 's'} outside range</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/patients/${patient.id}/edit`}
            className="text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Edit profile
          </Link>
          <Link
            href={`/patients/${patient.id}/table`}
            className="text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Marker table
          </Link>
          <a
            href={`/api/patients/${patient.id}/export/csv`}
            className="text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Export CSV
          </a>
          <Link
            href={`/patients/${patient.id}/summary`}
            className="text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Summary
          </Link>
          <Link
            href={`/reports/new?patientId=${patient.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add report
          </Link>
        </div>
      </div>

      {/* Category dashboard cards */}
      {categories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {categories.map(([cat, markers]) => {
            const outside = markers.filter((m) => m.status === 'high' || m.status === 'low').length
            return (
              <div key={cat} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-slate-700">{cat}</h3>
                  {outside > 0 && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      {outside} outside range
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {markers
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => (
                      <li key={m.markerKey} className="flex items-center justify-between gap-2 text-sm">
                        <Link
                          href={`/patients/${patient.id}/markers/${m.markerKey}`}
                          className="flex items-center gap-2 text-slate-600 hover:text-blue-600 truncate"
                        >
                          {statusDot(m.status)}
                          <span className="truncate">{m.name}</span>
                        </Link>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span className="font-medium tabular-nums text-slate-800">
                            {m.latestText ?? m.latest}
                            {m.unit && <span className="text-xs font-normal text-slate-400"> {m.unit}</span>}
                          </span>
                          {changeBadge(m)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="font-semibold text-slate-700 mb-3">Reports</h2>
      {patient.reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No reports yet. Add the first one to start tracking.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {patient.reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-800">{r.reportDate}</p>
                <p className="text-sm text-slate-500">
                  {[r.labName, r.reportType].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-1 rounded-full">
                  {r._count.markerResults} marker{r._count.markerResults === 1 ? '' : 's'}
                </span>
                {r._count.reportFiles > 0 && (
                  <span className="bg-slate-100 px-2 py-1 rounded-full">
                    {r._count.reportFiles} file{r._count.reportFiles === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
