import { prisma } from '@/lib/db'
import { saveUpload, allowedExtension, MAX_FILE_BYTES } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const files = await prisma.reportFile.findMany({
    where: { reportId: id },
    orderBy: { createdAt: 'asc' },
  })
  return Response.json(files)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params
  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = allowedExtension(file.name)
  if (!ext) {
    return Response.json(
      { error: 'Only PDF, JPG, PNG, and WEBP files are supported' },
      { status: 400 }
    )
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: 'File is larger than 20 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const relPath = await saveUpload(report.patientId, reportId, ext, buffer)

  const record = await prisma.reportFile.create({
    data: {
      reportId,
      filePath: relPath,
      fileType: ext,
      originalFilename: file.name,
      displayName: (formData.get('displayName') as string)?.trim() || file.name,
    },
  })
  return Response.json(record, { status: 201 })
}
