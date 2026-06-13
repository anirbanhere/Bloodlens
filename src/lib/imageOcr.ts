/**
 * Server-side image OCR using tesseract.js.
 * Traineddata is served from public/tessdata (baked into the build).
 * Must run in Node.js only — never import this in a client component.
 */
import path from 'path'

export interface OcrResult {
  text: string
  confidence: number // 0–1
}

export async function extractImageText(buffer: Buffer): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js')

  // langPath points to public/tessdata where eng.traineddata lives
  const langPath = path.join(process.cwd(), 'public', 'tessdata')

  const worker = await createWorker('eng', 1, {
    langPath,
    // Disable logger to keep server logs clean
    logger: () => {},
    errorHandler: () => {},
  })

  try {
    const { data } = await worker.recognize(buffer)
    return {
      text: data.text,
      confidence: (data.confidence ?? 0) / 100, // tesseract returns 0–100
    }
  } finally {
    await worker.terminate()
  }
}
