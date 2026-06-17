import { prisma } from '@/lib/db'
import { statusForType } from '@/lib/status'

/** Stable key from a free-text marker name, e.g. "Complement 3 (C3)" -> "custom_complement_3_c3". */
function customKey(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48)
  return `custom_${slug || 'marker'}`
}

/**
 * Create (or reuse) a MarkerDefinition for a user-confirmed unknown marker.
 * Returns the markerKey and registers its valueType in `typeByKey`. This is the
 * on-device "learn the mapping" step: once confirmed, the same test auto-matches
 * next time via the new alias.
 */
async function ensureCustomDefinition(
  name: string,
  value: number | null,
  valueText: string | null,
  typeByKey: Map<string, string>
): Promise<string> {
  const markerKey = customKey(name)
  const valueType = value !== null ? 'numeric' : valueText ? 'qualitative' : 'numeric'
  const alias = name.toLowerCase().replace(/\s+/g, ' ').trim()
  await prisma.markerDefinition.upsert({
    where: { markerKey },
    update: {},
    create: {
      markerKey,
      canonicalName: name,
      category: 'Other / Unrecognised',
      aliases: JSON.stringify([alias]),
      defaultUnit: null,
      description: 'User-added from an unrecognised report row',
      valueType,
    },
  })
  typeByKey.set(markerKey, valueType)
  return markerKey
}

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

    // An unknown (generically-extracted) candidate has no markerKey. Mint a
    // MarkerDefinition for it on confirm so the FK holds and the marker becomes
    // trendable — this is how the dictionary learns from what the user uploads.
    let markerKey = c.markerKey
    if (!markerKey) {
      markerKey = await ensureCustomDefinition(c.markerName, c.suggestedValue, c.suggestedValueText, typeByKey)
    }
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
        sortOrder: c.orderIndex,
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
