import { prisma } from '@/lib/db'
import { deleteUpload } from '@/lib/storage'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  const { fid } = await params
  const body = await request.json()
  if (!body.displayName?.trim()) {
    return Response.json({ error: 'displayName is required' }, { status: 400 })
  }
  const file = await prisma.reportFile.update({
    where: { id: fid },
    data: { displayName: body.displayName.trim() },
  })
  return Response.json(file)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  const { fid } = await params
  const file = await prisma.reportFile.findUnique({ where: { id: fid } })
  if (!file) return Response.json({ error: 'File not found' }, { status: 404 })

  await deleteUpload(file.filePath)
  await prisma.reportFile.delete({ where: { id: fid } })
  return Response.json({ ok: true })
}
