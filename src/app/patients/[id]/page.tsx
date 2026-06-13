import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import {
  Pencil, Table2, Download, FileText, Plus, ChevronRight,
  Activity, AlertTriangle, FlaskConical, CalendarDays, FileBarChart,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import StatCard from '@/components/ui/StatCard'
import StatusDot from '@/components/ui/StatusDot'

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
    return <span className="text-xs text-slate-500 tabular-nums">{txt}</span>
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/patients" className="text-brand-600 hover:underline">
            ← Patients
          </Link>
        }
        title={patient.name}
        subtitle={
          [patient.age ? `${patient.age} yrs` : null, patient.sex, patient.conditions]
            .filter(Boolean)
            .join(' · ') || 'No details yet'
        }
        actions={
          <>
            <Button href={`/patients/${patient.id}/edit`} variant="secondary" size="sm" icon={<Pencil size={15} />}>
              Edit
            </Button>
            <Button href={`/patients/${patient.id}/table`} variant="secondary" size="sm" icon={<Table2 size={15} />}>
              Table
            </Button>
            <Button href={`/api/patients/${patient.id}/export/csv`} variant="secondary" size="sm" icon={<Download size={15} />}>
              CSV
            </Button>
            <Button href={`/patients/${patient.id}/summary`} variant="secondary" size="sm" icon={<FileText size={15} />}>
              Summary
            </Button>
            <Button href={`/reports/new?patientId=${patient.id}`} size="sm" icon={<Plus size={15} />}>
              Add report
            </Button>
          </>
        }
      />

      {/* KPI stat row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Markers tracked" value={summaries.length} icon={<Activity size={20} />} tone="brand" />
        <StatCard
          label="Outside range"
          value={outsideTotal}
          icon={<AlertTriangle size={20} />}
          tone={outsideTotal > 0 ? 'alert' : 'ok'}
          hint={outsideTotal === 0 ? 'all in range' : undefined}
        />
        <StatCard label="Reports" value={patient.reports.length} icon={<FileBarChart size={20} />} tone="neutral" />
        <StatCard
          label="Last report"
          value={<span className="text-base">{latestReportDate || '—'}</span>}
          icon={<CalendarDays size={20} />}
          tone="neutral"
        />
      </div>

      {/* Category dashboard cards */}
      {categories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {categories.map(([cat, markers]) => {
            const outside = markers.filter((m) => m.status === 'high' || m.status === 'low').length
            return (
              <Card key={cat} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                    <FlaskConical size={15} className="text-brand-400" />
                    {cat}
                  </h3>
                  {outside > 0 && (
                    <span className="text-xs bg-alert-50 text-alert-700 border border-alert-100 px-2 py-0.5 rounded-full">
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
                          className="flex items-center gap-2 text-slate-600 hover:text-brand-600 truncate"
                        >
                          <StatusDot status={m.status} />
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
              </Card>
            )
          })}
        </div>
      )}

      <h2 className="font-semibold text-slate-700 mb-3">Reports</h2>
      {patient.reports.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          No reports yet. Add the first one to start tracking.
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {patient.reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition"
            >
              <div>
                <p className="font-medium text-slate-800">{r.reportDate || 'Date not set'}</p>
                <p className="text-sm text-slate-500">
                  {[r.labName, r.reportType].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge>{r._count.markerResults} marker{r._count.markerResults === 1 ? '' : 's'}</Badge>
                {r._count.reportFiles > 0 && (
                  <Badge>{r._count.reportFiles} file{r._count.reportFiles === 1 ? '' : 's'}</Badge>
                )}
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
