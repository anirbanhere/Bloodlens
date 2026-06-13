import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ExtractionReviewTable from '@/components/ExtractionReviewTable'

export const dynamic = 'force-dynamic'

export default async function ExtractionReviewPage({
  params,
}: {
  params: Promise<{ eid: string }>
}) {
  const { eid } = await params

  const extraction = await prisma.reportExtraction.findUnique({
    where: { id: eid },
    include: {
      report: { include: { patient: true } },
      file: true,
    },
  })
  if (!extraction) notFound()

  const candidates = await prisma.extractedCandidate.findMany({
    where: { extractionId: eid },
    orderBy: [{ confidence: 'desc' }, { markerName: 'asc' }],
  })

  const report = extraction.report
  const patient = report.patient
  const method = extraction.extractionMethod === 'image_ocr' ? 'OCR' : 'PDF text'

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-slate-500">
          <Link href={`/patients/${patient.id}`} className="text-blue-600 hover:underline">{patient.name}</Link>
          {' · '}
          <Link href={`/reports/${report.id}`} className="text-blue-600 hover:underline">Report {report.reportDate}</Link>
        </p>
        <h1 className="text-2xl font-bold text-slate-800 mt-1">Review extracted markers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Extracted via <span className="font-medium">{method}</span> from{' '}
          <span className="font-medium">{extraction.file.displayName ?? extraction.file.originalFilename}</span>
          {' · '}Confidence score: {Math.round((extraction.confidence ?? 0) * 100)}%
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800">
        Check each value carefully before saving. Extracted values may contain errors — verify against the original report.
        Only checked rows will be saved.
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <ExtractionReviewTable
          extractionId={eid}
          reportId={report.id}
          initialCandidates={candidates}
        />
      </div>

      <div className="mt-4">
        <details className="text-sm text-slate-500">
          <summary className="cursor-pointer hover:text-slate-700">Show raw extracted text</summary>
          <pre className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs whitespace-pre-wrap overflow-auto max-h-64">
            {extraction.rawText}
          </pre>
        </details>
      </div>
    </div>
  )
}
