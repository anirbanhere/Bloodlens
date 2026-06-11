import { prisma } from '@/lib/db'
import { computeStatus } from '@/lib/status'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params
  const body = await request.json()

  if (!body.markerKey || body.value == null || body.value === '') {
    return Response.json({ error: 'markerKey and value are required' }, { status: 400 })
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })

  const definition = await prisma.markerDefinition.findUnique({
    where: { markerKey: body.markerKey },
  })
  if (!definition) return Response.json({ error: 'Unknown marker' }, { status: 400 })

  const value = Number(body.value)
  const referenceLow = body.referenceLow !== '' && body.referenceLow != null ? Number(body.referenceLow) : null
  const referenceHigh = body.referenceHigh !== '' && body.referenceHigh != null ? Number(body.referenceHigh) : null

  const result = await prisma.markerResult.create({
    data: {
      reportId,
      patientId: report.patientId,
      markerKey: body.markerKey,
      markerName: body.markerName?.trim() || definition.canonicalName,
      value,
      unit: body.unit?.trim() || definition.defaultUnit,
      referenceLow,
      referenceHigh,
      status: computeStatus(value, referenceLow, referenceHigh),
      sourceType: 'manual',
      userVerified: true,
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(result, { status: 201 })
}
