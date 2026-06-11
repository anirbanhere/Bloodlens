import { mkdir, writeFile, unlink, readFile, stat } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Railway: set UPLOAD_DIR=/data/uploads (volume mount). Local dev: ./data/uploads
const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads')

export const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function allowedExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ext in CONTENT_TYPES ? ext : null
}

export function contentTypeFor(ext: string): string {
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

/** Saves a file under patient-{pid}/report-{rid}/ and returns its path relative to the upload root. */
export async function saveUpload(
  patientId: string,
  reportId: string,
  ext: string,
  data: Buffer
): Promise<string> {
  const relDir = path.join(`patient-${patientId}`, `report-${reportId}`)
  const absDir = path.join(UPLOAD_ROOT, relDir)
  await mkdir(absDir, { recursive: true })
  const filename = `${crypto.randomUUID()}.${ext}`
  await writeFile(path.join(absDir, filename), data)
  return path.join(relDir, filename)
}

/** Resolves a stored relative path against the upload root, refusing anything that escapes it. */
function resolveSafe(relPath: string): string {
  const abs = path.resolve(UPLOAD_ROOT, relPath)
  if (!abs.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error('Invalid file path')
  }
  return abs
}

export async function readUpload(relPath: string): Promise<Buffer> {
  return readFile(resolveSafe(relPath))
}

export async function uploadExists(relPath: string): Promise<boolean> {
  try {
    await stat(resolveSafe(relPath))
    return true
  } catch {
    return false
  }
}

export async function deleteUpload(relPath: string): Promise<void> {
  try {
    await unlink(resolveSafe(relPath))
  } catch {
    // already gone — fine
  }
}
