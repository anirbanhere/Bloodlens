import { prisma } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      patient: true,
      markerResults: { orderBy: { markerName: 'asc' } },
      reportFiles: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  return Response.json(report)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const report = await prisma.report.update({
    where: { id },
    data: {
      reportDate: body.reportDate ?? undefined,
      labName: body.labName?.trim() || null,
      reportType: body.reportType || null,
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(report)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.report.delete({ where: { id } })
  return Response.json({ ok: true })
}
