import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import MarkerEntry from '@/components/MarkerEntry'
import FileSection from '@/components/FileSection'
import DeleteReportButton from '@/components/DeleteReportButton'
import PageHeader from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      patient: true,
      markerResults: { orderBy: [{ sortOrder: 'asc' }, { markerName: 'asc' }] },
      reportFiles: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!report) notFound()

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/patients/${report.patientId}`} className="text-brand-600 hover:underline">
            ← {report.patient.name}
          </Link>
        }
        title={`Report — ${report.reportDate || 'date not set'}`}
        subtitle={[report.labName, report.reportType, report.notes].filter(Boolean).join(' · ') || undefined}
        actions={<DeleteReportButton reportId={report.id} patientId={report.patientId} />}
      />

      <MarkerEntry reportId={report.id} markers={report.markerResults} />

      <div className="mt-6">
        <FileSection reportId={report.id} files={report.reportFiles} />
      </div>
    </div>
  )
}
