import Link from 'next/link'
import { notFound } from 'next/navigation'
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

  // Build columns from markers actually present, keeping dictionary category order
  const seen = new Map<string, TableColumn>()
  for (const r of results) {
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

  // Pivot: one row per report date
  const rowMap = new Map<string, TableRow>()
  for (const r of results) {
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
    </div>
  )
}
