export async function GET() {
  return Response.json({ ok: true, service: 'health-tracker', timestamp: new Date().toISOString() })
}
