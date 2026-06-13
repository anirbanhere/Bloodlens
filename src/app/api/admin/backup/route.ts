import { createBackupStream, backupFilename } from '@/lib/backup'
import { Readable } from 'stream'

export async function GET() {
  const filename = backupFilename()
  const nodeStream = createBackupStream()

  // Convert Node.js Readable to Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
  })

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
