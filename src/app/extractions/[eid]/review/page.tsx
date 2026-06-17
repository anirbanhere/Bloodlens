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

  const CONF_ORDER = { low: 0, medium: 1, high: 2 } as const
  const candidatesRaw = await prisma.extractedCandidate.findMany({
    where: { extractionId: eid },
    orderBy: { orderIndex: 'asc' },
  })
  // Low-confidence rows first so they get manual attention before high-confidence ones.
  // Within each tier, document order is preserved as a tiebreaker.
  const candidates = [...candidatesRaw].sort((a, b) => {
    const ca = CONF_ORDER[a.confidence as keyof typeof CONF_ORDER] ?? 1
    const cb = CONF_ORDER[b.confidence as keyof typeof CONF_ORDER] ?? 1
    return ca - cb || a.orderIndex - b.orderIndex
  })

  const report = extraction.report
  const patient = report.patient
  const method = extraction.extractionMethod === 'image_ocr' ? 'OCR' : 'PDF text'

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-slate-500">
          <Link href={`/patients/${patient.id}`} className="text-brand-600 hover:underline">{patient.name}</Link>
          {' · '}
          <Link href={`/reports/${report.id}`} className="text-brand-600 hover:underline">Report {report.reportDate}</Link>
        </p>
        <h1 className="text-2xl font-bold text-slate-800 mt-1 tracking-tight">Review extracted markers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Extracted via <span className="font-medium">{method}</span> from{' '}
          <span className="font-medium">{extraction.file.displayName ?? extraction.file.originalFilename}</span>
          {' · '}Confidence score: {Math.round((extraction.confidence ?? 0) * 100)}%
        </p>
      </div>

      <div className="bg-warn-50 border border-warn-100 rounded-lg px-4 py-3 mb-5 text-sm text-warn-700">
        Check each value carefully before saving. Extracted values may contain errors — verify against the original report.
        Only checked rows will be saved.
      </div>

      <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-5">
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
