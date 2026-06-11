import { prisma } from '@/lib/db'

export async function GET() {
  const definitions = await prisma.markerDefinition.findMany({
    orderBy: [{ category: 'asc' }, { canonicalName: 'asc' }],
  })
  return Response.json(definitions)
}
