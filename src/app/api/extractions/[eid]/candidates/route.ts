import { prisma } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eid: string }> }
) {
  const { eid } = await params
  const candidates = await prisma.extractedCandidate.findMany({
    where: { extractionId: eid },
    orderBy: [{ confidence: 'desc' }, { markerName: 'asc' }],
  })
  return Response.json(candidates)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eid: string }> }
) {
  const { eid } = await params
  const body = await request.json()
  const { candidateId, ...updates } = body as {
    candidateId: string
    markerName?: string
    suggestedValue?: number | null
    suggestedUnit?: string | null
    suggestedReferenceLow?: number | null
    suggestedReferenceHigh?: number | null
    status?: string
  }
  if (!candidateId) return Response.json({ error: 'candidateId required' }, { status: 400 })

  const candidate = await prisma.extractedCandidate.findFirst({
    where: { id: candidateId, extractionId: eid },
  })
  if (!candidate) return Response.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.extractedCandidate.update({
    where: { id: candidateId },
    data: updates,
  })
  return Response.json(updated)
}
