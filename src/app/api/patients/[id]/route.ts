import { prisma } from '@/lib/db'
import { deleteUpload } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { reports: { orderBy: { reportDate: 'desc' } } },
  })
  if (!patient) return Response.json({ error: 'Patient not found' }, { status: 404 })
  return Response.json(patient)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  if (!body.name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }
  const patient = await prisma.patient.update({
    where: { id },
    data: {
      name: body.name.trim(),
      age: body.age ? Number(body.age) : null,
      sex: body.sex || null,
      conditions: body.conditions?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(patient)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const patient = await prisma.patient.findUnique({ where: { id } })
  if (!patient) return Response.json({ error: 'Patient not found' }, { status: 404 })

  // Remove the patient's uploaded files from disk before the DB rows cascade
  // away (the cascade deletes ReportFile rows but not the physical files).
  const files = await prisma.reportFile.findMany({
    where: { report: { patientId: id } },
    select: { filePath: true },
  })
  await Promise.allSettled(files.map((f) => deleteUpload(f.filePath)))

  // Cascade-deletes reports, marker results, files, extractions and health events.
  await prisma.patient.delete({ where: { id } })
  return Response.json({ ok: true })
}
