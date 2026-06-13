import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const patientId = url.searchParams.get('patientId')
  const reports = await prisma.report.findMany({
    where: patientId ? { patientId } : undefined,
    orderBy: { reportDate: 'desc' },
    include: { _count: { select: { markerResults: true, reportFiles: true } } },
  })
  return Response.json(reports)
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.patientId) {
    return Response.json({ error: 'patientId is required' }, { status: 400 })
  }
  const report = await prisma.report.create({
    data: {
      patientId: body.patientId,
      reportDate: body.reportDate?.trim() || '', // optional — auto-filled from PDF on extraction
      labName: body.labName?.trim() || null,
      reportType: body.reportType || null,
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(report, { status: 201 })
}
