import { prisma } from '@/lib/db'
import { statusForType } from '@/lib/status'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params
  const body = await request.json()

  const hasValue = body.value != null && body.value !== ''
  const hasValueText = typeof body.valueText === 'string' && body.valueText.trim() !== ''
  if (!body.markerKey || (!hasValue && !hasValueText)) {
    return Response.json({ error: 'markerKey and a value (or text value) are required' }, { status: 400 })
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })

  const definition = await prisma.markerDefinition.findUnique({
    where: { markerKey: body.markerKey },
  })
  if (!definition) return Response.json({ error: 'Unknown marker' }, { status: 400 })

  const value = hasValue ? Number(body.value) : null
  const valueText = hasValueText ? body.valueText.trim() : null
  const referenceLow = body.referenceLow !== '' && body.referenceLow != null ? Number(body.referenceLow) : null
  const referenceHigh = body.referenceHigh !== '' && body.referenceHigh != null ? Number(body.referenceHigh) : null

  // Append manual entries after existing markers in this report.
  const last = await prisma.markerResult.findFirst({
    where: { reportId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const sortOrder = (last?.sortOrder ?? -1) + 1

  const result = await prisma.markerResult.create({
    data: {
      reportId,
      patientId: report.patientId,
      markerKey: body.markerKey,
      markerName: body.markerName?.trim() || definition.canonicalName,
      value,
      valueText,
      unit: body.unit?.trim() || definition.defaultUnit,
      referenceLow,
      referenceHigh,
      status: statusForType(definition.valueType, value, referenceLow, referenceHigh),
      sortOrder,
      sourceType: 'manual',
      userVerified: true,
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(result, { status: 201 })
}
