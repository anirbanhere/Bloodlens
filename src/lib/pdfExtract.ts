/**
 * Server-side PDF text extraction using pdfjs-dist legacy build (Node.js compatible).
 * Must run in Node.js only — never import this in a client component.
 */

let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // Disable worker — required for server-side use
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  }
  return pdfjsLib
}

export interface PdfExtractionResult {
  text: string
  pageCount: number
  confidence: number // 1.0 for digital PDFs (text layer present), 0 for image-only
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  const pdfjs = await getPdfjs()

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise

  const pageTexts: string[] = []
  let totalChars = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(pageText)
    totalChars += pageText.trim().length
  }

  const text = pageTexts.join('\n\n')

  // If very few characters extracted, the PDF is likely image-only
  const confidence = totalChars > 50 ? 1.0 : 0.0

  return { text, pageCount: pdf.numPages, confidence }
}
