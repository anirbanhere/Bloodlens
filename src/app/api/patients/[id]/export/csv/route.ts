import { prisma } from '@/lib/db'

function csvEscape(field: string | number | null | undefined): string {
  if (field == null) return ''
  const s = String(field)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patient = await prisma.patient.findUnique({ where: { id } })
  if (!patient) return Response.json({ error: 'Patient not found' }, { status: 404 })

  const results = await prisma.markerResult.findMany({
    where: { patientId: id },
    include: { report: { select: { reportDate: true, labName: true } } },
    orderBy: [{ report: { reportDate: 'asc' } }, { markerName: 'asc' }],
  })

  const header = 'date,lab,marker,value,value_text,unit,reference_low,reference_high,status,notes'
  const lines = results.map((r) =>
    [
      r.report.reportDate,
      r.report.labName,
      r.markerName,
      r.value,
      r.valueText,
      r.unit,
      r.referenceLow,
      r.referenceHigh,
      r.status,
      r.notes,
    ]
      .map(csvEscape)
      .join(',')
  )
  const csv = [header, ...lines].join('\n')

  const safeName = patient.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bloodlens-${safeName}-${date}.csv"`,
    },
  })
}
