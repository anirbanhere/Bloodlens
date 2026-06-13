import { generatePatientSummary } from '@/lib/summaryGenerator'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const summary = await generatePatientSummary(id)
    return Response.json(summary)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 404 })
  }
}
