import { prisma } from '@/lib/db'
import { statusForType } from '@/lib/status'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { mid } = await params
  const body = await request.json()

  const existing = await prisma.markerResult.findUnique({ where: { id: mid } })
  if (!existing) return Response.json({ error: 'Marker not found' }, { status: 404 })

  const definition = await prisma.markerDefinition.findUnique({
    where: { markerKey: existing.markerKey },
  })
  const valueType = definition?.valueType ?? 'numeric'

  const hasValue = body.value != null && body.value !== ''
  const hasValueText = typeof body.valueText === 'string' && body.valueText.trim() !== ''
  if (!hasValue && !hasValueText) {
    return Response.json({ error: 'A value (or text value) is required' }, { status: 400 })
  }

  const value = hasValue ? Number(body.value) : null
  if (value !== null && Number.isNaN(value)) {
    return Response.json({ error: 'Value must be a number' }, { status: 400 })
  }
  const valueText = hasValueText ? body.valueText.trim() : null
  const referenceLow = body.referenceLow !== '' && body.referenceLow != null ? Number(body.referenceLow) : null
  const referenceHigh = body.referenceHigh !== '' && body.referenceHigh != null ? Number(body.referenceHigh) : null

  const result = await prisma.markerResult.update({
    where: { id: mid },
    data: {
      value,
      valueText,
      unit: body.unit?.trim() || null,
      referenceLow,
      referenceHigh,
      status: statusForType(valueType, value, referenceLow, referenceHigh),
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(result)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { mid } = await params
  await prisma.markerResult.delete({ where: { id: mid } })
  return Response.json({ ok: true })
}
