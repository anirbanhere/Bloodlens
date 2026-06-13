import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import MarkerEntry from '@/components/MarkerEntry'
import FileSection from '@/components/FileSection'
import DeleteReportButton from '@/components/DeleteReportButton'

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
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-sm text-slate-500">
            <Link href={`/patients/${report.patientId}`} className="text-blue-600 hover:underline">
              {report.patient.name}
            </Link>
          </p>
          <h1 className="text-2xl font-bold text-slate-800">Report — {report.reportDate || 'date not set'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {[report.labName, report.reportType, report.notes].filter(Boolean).join(' · ') || ''}
          </p>
        </div>
        <DeleteReportButton reportId={report.id} patientId={report.patientId} />
      </div>

      <MarkerEntry reportId={report.id} markers={report.markerResults} />

      <div className="mt-6">
        <FileSection reportId={report.id} files={report.reportFiles} />
      </div>
    </div>
  )
}
