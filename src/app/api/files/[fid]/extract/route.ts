import { prisma } from '@/lib/db'
import { readUpload } from '@/lib/storage'
import { extractPdfText, PdfPasswordError } from '@/lib/pdfExtract'
import { extractImageText } from '@/lib/imageOcr'
import { parseMarkers } from '@/lib/markerParser'
import { extractReportDate } from '@/lib/reportMeta'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  const { fid } = await params
  const body = await request.json().catch(() => ({}))
  const password: string | undefined = typeof body.password === 'string' && body.password ? body.password : undefined
  const file = await prisma.reportFile.findUnique({ where: { id: fid } })
  if (!file) return Response.json({ error: 'File not found' }, { status: 404 })

  const isPdf = file.fileType === 'pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(file.fileType)
  if (!isPdf && !isImage) {
    return Response.json({ error: 'Unsupported file type for extraction' }, { status: 400 })
  }

  // Check if already extracted
  const existing = await prisma.reportExtraction.findFirst({
    where: { fileId: fid },
  })
  if (existing) {
    return Response.json({ extractionId: existing.id, alreadyExists: true })
  }

  let buffer: Buffer
  try {
    buffer = await readUpload(file.filePath)
  } catch {
    return Response.json({ error: 'File missing from storage' }, { status: 404 })
  }

  // Extract text
  let rawText = ''
  let confidence = 0
  let extractionMethod = ''

  try {
    if (isPdf) {
      const result = await extractPdfText(buffer, password)
      rawText = result.text
      confidence = result.confidence
      extractionMethod = 'pdf_text'
    } else {
      const result = await extractImageText(buffer)
      rawText = result.text
      confidence = result.confidence
      extractionMethod = 'image_ocr'
    }
  } catch (err: unknown) {
    if (err instanceof PdfPasswordError) {
      return Response.json(
        { error: err.message, passwordRequired: true, wrongPassword: err.wrongPassword },
        { status: 422 }
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[extract] extraction error:', msg)
    return Response.json({ error: `Extraction error: ${msg}` }, { status: 500 })
  }

  if (!rawText.trim()) {
    return Response.json(
      { error: 'No text could be extracted. This may be a scanned/image-only PDF — try the OCR path by uploading the file as an image.' },
      { status: 422 }
    )
  }

  // Auto-fill the report date from the document if it wasn't set manually.
  const report = await prisma.report.findUnique({ where: { id: file.reportId } })
  if (report && !report.reportDate) {
    const parsedDate = extractReportDate(rawText)
    if (parsedDate) {
      await prisma.report.update({ where: { id: file.reportId }, data: { reportDate: parsedDate } })
    }
  }

  // Save extraction record
  const extraction = await prisma.reportExtraction.create({
    data: {
      reportId: file.reportId,
      fileId: fid,
      extractionMethod,
      rawText,
      confidence,
    },
  })

  // Parse candidates against all marker definitions
  const defs = await prisma.markerDefinition.findMany()
  const candidates = parseMarkers(
    rawText,
    defs.map((d) => ({
      markerKey: d.markerKey,
      canonicalName: d.canonicalName,
      aliases: d.aliases,
      defaultUnit: d.defaultUnit,
      valueType: d.valueType,
      category: d.category,
    }))
  )

  // Persist candidates, preserving document order via orderIndex.
  await prisma.extractedCandidate.createMany({
    data: candidates.map((c, i) => ({
      extractionId: extraction.id,
      reportId: file.reportId,
      fileId: fid,
      markerKey: c.markerKey,
      markerName: c.markerName,
      suggestedValue: c.suggestedValue,
      suggestedValueText: c.suggestedValueText,
      suggestedUnit: c.suggestedUnit,
      suggestedReferenceLow: c.suggestedReferenceLow,
      suggestedReferenceHigh: c.suggestedReferenceHigh,
      confidence: c.confidence,
      sourceText: c.sourceText,
      orderIndex: i,
      status: 'pending',
    })),
  })

  return Response.json({ extractionId: extraction.id, candidateCount: candidates.length }, { status: 201 })
}
