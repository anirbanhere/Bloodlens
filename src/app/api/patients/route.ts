import { prisma } from '@/lib/db'

export async function GET() {
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { reports: true } } },
  })
  return Response.json(patients)
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }
  const patient = await prisma.patient.create({
    data: {
      name: body.name.trim(),
      age: body.age ? Number(body.age) : null,
      sex: body.sex || null,
      conditions: body.conditions?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  })
  return Response.json(patient, { status: 201 })
}
