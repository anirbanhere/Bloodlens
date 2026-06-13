import { prisma } from '@/lib/db'
import { statusForType } from '@/lib/status'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eid: string }> }
) {
  const { eid } = await params

  const extraction = await prisma.reportExtraction.findUnique({ where: { id: eid } })
  if (!extraction) return Response.json({ error: 'Extraction not found' }, { status: 404 })

  const candidates = await prisma.extractedCandidate.findMany({
    where: { extractionId: eid, status: 'accepted' },
  })

  if (candidates.length === 0) {
    return Response.json({ error: 'No accepted candidates to save' }, { status: 400 })
  }

  const report = await prisma.report.findUnique({ where: { id: extraction.reportId } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })

  // Look up valueType per marker so status is computed correctly per type.
  const defs = await prisma.markerDefinition.findMany({ select: { markerKey: true, valueType: true } })
  const typeByKey = new Map(defs.map((d) => [d.markerKey, d.valueType]))

  let saved = 0
  let skipped = 0

  for (const c of candidates) {
    // Save if we have either a numeric value or a text value.
    if (c.suggestedValue === null && !c.suggestedValueText) { skipped++; continue }

    const markerKey = c.markerKey ?? 'custom'
    const valueType = typeByKey.get(markerKey) ?? 'numeric'
    const status = statusForType(valueType, c.suggestedValue, c.suggestedReferenceLow, c.suggestedReferenceHigh)

    // Remove any existing result for this marker in this report before creating
    await prisma.markerResult.deleteMany({
      where: { reportId: extraction.reportId, markerKey },
    })
    await prisma.markerResult.create({
      data: {
        reportId: extraction.reportId,
        patientId: report.patientId,
        markerKey,
        markerName: c.markerName,
        value: c.suggestedValue,
        valueText: c.suggestedValueText,
        unit: c.suggestedUnit,
        referenceLow: c.suggestedReferenceLow,
        referenceHigh: c.suggestedReferenceHigh,
        status,
        sourceType: 'extracted',
        sourceFileId: c.fileId,
        userVerified: true,
      },
    })
    saved++
  }

  // Mark all accepted candidates as confirmed in the DB
  await prisma.extractedCandidate.updateMany({
    where: { extractionId: eid, status: 'accepted' },
    data: { status: 'confirmed' },
  })

  return Response.json({ saved, skipped })
}
