/**
 * Streams a ZIP backup containing the SQLite database and all uploaded files.
 * Uses the archiver package.
 */
import path from 'path'
import fs from 'fs'
import { ZipArchive } from 'archiver'
import { Readable } from 'stream'

const DB_PATH = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^file:/, '')
  : path.join(process.cwd(), 'dev.db')

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads')

/**
 * Returns a Node.js Readable stream that produces a ZIP archive.
 * Caller is responsible for piping it to the response.
 */
export function createBackupStream(): Readable {
  const archive = new ZipArchive({ zlib: { level: 6 } })

  // Add the database file
  const dbAbs = path.resolve(DB_PATH)
  if (fs.existsSync(dbAbs)) {
    archive.file(dbAbs, { name: 'backup/health.db' })
  }

  // Add all uploaded files
  if (fs.existsSync(UPLOAD_ROOT)) {
    archive.directory(UPLOAD_ROOT, 'backup/uploads')
  }

  archive.finalize()

  return archive
}

export function backupFilename(): string {
  const d = new Date().toISOString().slice(0, 10)
  return `bloodlens-backup-${d}.zip`
}
