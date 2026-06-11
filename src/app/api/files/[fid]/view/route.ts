import { prisma } from '@/lib/db'
import { readUpload, contentTypeFor } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  const { fid } = await params
  const file = await prisma.reportFile.findUnique({ where: { id: fid } })
  if (!file) return Response.json({ error: 'File not found' }, { status: 404 })

  let data: Buffer
  try {
    data = await readUpload(file.filePath)
  } catch {
    return Response.json({ error: 'File missing from storage' }, { status: 404 })
  }

  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': contentTypeFor(file.fileType),
      'Content-Disposition': `inline; filename="${file.originalFilename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
