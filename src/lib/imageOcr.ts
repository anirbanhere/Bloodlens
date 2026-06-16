/**
 * Server-side image OCR using PaddleOCR PP-OCRv6 (small) via ppu-paddle-ocr + ONNX Runtime.
 * Models are bundled in models/ocr (det.onnx, rec.onnx, dict.txt) and baked into the deploy.
 * Must run in Node.js only — never import this in a client component.
 */
import path from 'path'
import { promises as fs } from 'fs'

export interface OcrResult {
  text: string
  confidence: number // 0–1
}

const MODEL_DIR = path.join(process.cwd(), 'models', 'ocr')

// PaddleOcrService is expensive to construct (loads two ONNX sessions), so build
// it once per process and reuse it across requests.
type PaddleService = {
  recognize: (image: ArrayBuffer) => Promise<{ text: string; confidence: number }>
}
let servicePromise: Promise<PaddleService> | null = null

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

async function getService(): Promise<PaddleService> {
  if (!servicePromise) {
    servicePromise = (async () => {
      const { PaddleOcrService } = await import('ppu-paddle-ocr')
      const [det, rec, dict] = await Promise.all([
        fs.readFile(path.join(MODEL_DIR, 'det.onnx')),
        fs.readFile(path.join(MODEL_DIR, 'rec.onnx')),
        fs.readFile(path.join(MODEL_DIR, 'dict.txt')),
      ])
      const service = new PaddleOcrService({
        model: {
          detection: toArrayBuffer(det),
          recognition: toArrayBuffer(rec),
          charactersDictionary: toArrayBuffer(dict),
        },
      })
      await service.initialize()
      return service as unknown as PaddleService
    })().catch((err) => {
      // Reset so a later call can retry instead of caching the failure.
      servicePromise = null
      throw err
    })
  }
  return servicePromise
}

export async function extractImageText(buffer: Buffer): Promise<OcrResult> {
  const service = await getService()
  const result = await service.recognize(toArrayBuffer(buffer))
  return {
    text: result.text ?? '',
    confidence: result.confidence ?? 0, // ppu-paddle-ocr already returns 0–1
  }
}
