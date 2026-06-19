import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { prisma } from '@/lib/db'
import MarkerTable, { type TableColumn, type TableRow } from '@/components/MarkerTable'
import PageHeader from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function MarkerTablePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = await prisma.patient.findUnique({ where: { id } })
  if (!patient) notFound()

  const [results, definitions] = await Promise.all([
    prisma.markerResult.findMany({
      where: { patientId: id },
      include: { report: { select: { id: true, reportDate: true, labName: true } } },
    }),
    prisma.markerDefinition.findMany(),
  ])

  const categoryByKey = new Map(definitions.map((d) => [d.markerKey, d.category]))
  const valueTypeByKey = new Map(definitions.map((d) => [d.markerKey, d.valueType]))

  // Qualitative results are descriptive free text — they don't belong in a
  // numeric pivot (one long sentence would blow out the column). Split them off
  // and show them per report below the table.
  const isQualitative = (key: string) => valueTypeByKey.get(key) === 'qualitative'
  const numericResults = results.filter((r) => !isQualitative(r.markerKey))

  // Build columns from numeric markers actually present, keeping category order
  const seen = new Map<string, TableColumn>()
  for (const r of numericResults) {
    if (!seen.has(r.markerKey)) {
      seen.set(r.markerKey, {
        markerKey: r.markerKey,
        name: r.markerName,
        unit: r.unit,
        category: categoryByKey.get(r.markerKey) ?? 'Other',
      })
    }
  }
  const columns = [...seen.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  )

  // Pivot: one row per report date (numeric markers only)
  const rowMap = new Map<string, TableRow>()
  for (const r of numericResults) {
    let row = rowMap.get(r.reportId)
    if (!row) {
      row = {
        reportId: r.reportId,
        reportDate: r.report.reportDate,
        labName: r.report.labName,
        values: {},
      }
      rowMap.set(r.reportId, row)
    }
    row.values[r.markerKey] = { value: r.value, valueText: r.valueText, status: r.status }
  }
  const rows = [...rowMap.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate))

  // Qualitative findings grouped by report (newest first), for the notes section.
  type QualReport = { reportId: string; reportDate: string; labName: string | null; items: { markerKey: string; name: string; text: string }[] }
  const qualMap = new Map<string, QualReport>()
  for (const r of results) {
    if (!isQualitative(r.markerKey) || !(r.valueText ?? '').trim()) continue
    let block = qualMap.get(r.reportId)
    if (!block) {
      block = { reportId: r.reportId, reportDate: r.report.reportDate, labName: r.report.labName, items: [] }
      qualMap.set(r.reportId, block)
    }
    block.items.push({ markerKey: r.markerKey, name: r.markerName, text: r.valueText! })
  }
  const qualReports = [...qualMap.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate))

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/patients/${id}`} className="text-brand-600 hover:underline">
            ← {patient.name}
          </Link>
        }
        title="Marker table"
      />
      <MarkerTable patientId={id} columns={columns} rows={rows} />

      {qualReports.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-brand-400" />
            Observations &amp; notes
          </h2>
          <div className="space-y-4">
            {qualReports.map((rep) => (
              <div key={rep.reportId} className="bg-surface rounded-card border border-slate-200/80 shadow-card p-5">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <Link href={`/reports/${rep.reportId}`} className="font-medium text-sm text-slate-700 hover:text-brand-600">
                    {rep.reportDate}
                  </Link>
                  {rep.labName && <span className="text-xs text-slate-400">{rep.labName}</span>}
                </div>
                <ul className="space-y-3">
                  {rep.items
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((it) => (
                      <li key={it.markerKey} className="border-l-2 border-brand-100 pl-3">
                        <Link
                          href={`/patients/${id}/markers/${it.markerKey}`}
                          className="font-medium text-sm text-slate-700 hover:text-brand-600"
                        >
                          {it.name}
                        </Link>
                        <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                          {it.text}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
