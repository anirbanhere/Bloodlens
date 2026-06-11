import { prisma } from '@/lib/db'
import { computeStatus } from '@/lib/status'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { mid } = await params
  const body = await request.json()

  const value = Number(body.value)
  if (Number.isNaN(value)) {
    return Response.json({ error: 'A numeric value is required' }, { status: 400 })
  }
  const referenceLow = body.referenceLow !== '' && body.referenceLow != null ? Number(body.referenceLow) : null
  const referenceHigh = body.referenceHigh !== '' && body.referenceHigh != null ? Number(body.referenceHigh) : null

  const result = await prisma.markerResult.update({
    where: { id: mid },
    data: {
      value,
      unit: body.unit?.trim() || null,
      referenceLow,
      referenceHigh,
      status: computeStatus(value, referenceLow, referenceHigh),
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
