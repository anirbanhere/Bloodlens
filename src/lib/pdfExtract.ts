/**
 * Server-side PDF text extraction using pdfjs-dist legacy build (Node.js compatible).
 * Must run in Node.js only — never import this in a client component.
 */
import path from 'path'
import { pathToFileURL } from 'url'

let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null

async function getPdfjs() {
  if (!pdfjsLib) {
    // pdfjs requires DOMMatrix even for text extraction — stub it if missing
    if (typeof globalThis.DOMMatrix === 'undefined') {
      // @ts-expect-error — minimal stub for Node.js environment
      globalThis.DOMMatrix = class DOMMatrix {
        constructor() { return this }
        static fromMatrix() { return new (globalThis.DOMMatrix as any)() }
      }
    }
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // pdfjs-dist v6 requires workerSrc to be a file:// URL pointing to the worker
    const workerPath = path.resolve(
      process.cwd(),
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
    )
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
  }
  return pdfjsLib
}

export interface PdfExtractionResult {
  text: string
  pageCount: number
  confidence: number // 1.0 for digital PDFs (text layer present), 0 for image-only
}

// Thrown when the PDF requires a password (or the supplied password is wrong).
export class PdfPasswordError extends Error {
  constructor(public readonly wrongPassword: boolean) {
    super(wrongPassword ? 'Incorrect PDF password' : 'PDF is password-protected')
    this.name = 'PdfPasswordError'
  }
}

/**
 * pdfjs returns text as positioned fragments with no line structure.
 * Group fragments by their Y coordinate into visual rows, sort each row
 * left-to-right by X, and join — reconstructing the original table layout.
 */
function reconstructLines(items: ReadonlyArray<unknown>): string {
  const Y_TOLERANCE = 3 // fragments within 3 units of Y are on the same line

  type Frag = { x: number; y: number; str: string }
  const frags: Frag[] = []

  for (const item of items) {
    const it = item as { str?: string; transform?: number[] }
    if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue
    frags.push({ x: it.transform[4], y: it.transform[5], str: it.str })
  }

  // Bucket fragments into rows by Y position
  const rows: { y: number; frags: Frag[] }[] = []
  for (const f of frags) {
    let row = rows.find((r) => Math.abs(r.y - f.y) <= Y_TOLERANCE)
    if (!row) {
      row = { y: f.y, frags: [] }
      rows.push(row)
    }
    row.frags.push(f)
  }

  // Top-to-bottom (PDF Y increases upward, so sort descending)
  rows.sort((a, b) => b.y - a.y)

  return rows
    .map((r) =>
      r.frags
        .sort((a, b) => a.x - b.x)
        .map((f) => f.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
}

export async function extractPdfText(buffer: Buffer, password?: string): Promise<PdfExtractionResult> {
  const pdfjs = await getPdfjs()

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    ...(password != null ? { password } : {}),
  })

  let pdf: Awaited<typeof loadingTask.promise>
  try {
    pdf = await loadingTask.promise
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number }
    if (e?.name === 'PasswordException') {
      // code 1 = NEED_PASSWORD, code 2 = INCORRECT_PASSWORD
      throw new PdfPasswordError(e.code === 2)
    }
    throw err
  }

  const pageTexts: string[] = []
  let totalChars = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = reconstructLines(content.items)
    pageTexts.push(pageText)
    totalChars += pageText.replace(/\s/g, '').length
  }

  const text = pageTexts.join('\n\n')

  // If very few characters extracted, the PDF is likely image-only
  const confidence = totalChars > 50 ? 1.0 : 0.0

  return { text, pageCount: pdf.numPages, confidence }
}
