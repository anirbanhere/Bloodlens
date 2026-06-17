/**
 * Demo fixture for the browser walkthrough: generates a clean text PDF of a
 * Gleneagles-style biochemistry report (incl. C3/C4) and wires up a patient +
 * report + file row pointing at it, using the app's own storage layer. After
 * this runs, hit the real extract API for the printed fileId.
 *
 *   npx tsx scripts/demo_setup.ts
 */
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { saveUpload } from '../src/lib/storage'
import 'dotenv/config'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' })
const prisma = new PrismaClient({ adapter } as any)

const ROWS = [
  'Gleneagles Hospital - Department of Biochemistry',
  'Patient Name: Demo Patient    Age: 57 Years    Sex: Male',
  'Sample Collected: 12-06-2026',
  'TEST                            RESULT    UNIT      REFERENCE',
  'COMPLEMENT 3 (C3), SERUM        145       mg/dl     90 - 180',
  'COMPLEMENT 4 (C4), SERUM        28        mg/dl     10 - 40',
  'CREATININE, SERUM               0.9       mg/dl     0.7 - 1.3',
  'HAEMOGLOBIN                     13.5      g/dl      13 - 17',
  'IMMUNOGLOBULIN G (IgG), SERUM   1100      mg/dl     700 - 1600',
  '*** End of Report ***',
]

/** Minimal single-page PDF: one positioned text line per row (clean text layer). */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  let content = 'BT\n/F1 11 Tf\n'
  let y = 770
  for (const ln of lines) {
    content += `1 0 0 1 50 ${y} Tm (${esc(ln)}) Tj\n`
    y -= 24
  }
  content += 'ET'

  const objs: string[] = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'
  objs[4] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1')
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`
  }
  const xrefOff = Buffer.byteLength(pdf, 'latin1')
  const n = objs.length
  pdf += `xref\n0 ${n}\n0000000000 65535 f \n`
  for (let i = 1; i < n; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

async function main() {
  const patient = await prisma.patient.create({
    data: { name: 'Demo Patient (LOINC/C3 test)', age: 57, sex: 'Male' },
  })
  const report = await prisma.report.create({
    data: { patientId: patient.id, reportDate: '', labName: 'Gleneagles', reportType: 'Biochemistry' },
  })
  const buf = makePdf(ROWS)
  const relPath = await saveUpload(patient.id, report.id, 'pdf', buf)
  const file = await prisma.reportFile.create({
    data: {
      reportId: report.id,
      filePath: relPath,
      fileType: 'pdf',
      originalFilename: 'gleneagles_biochem.pdf',
      displayName: 'Gleneagles Biochemistry',
    },
  })

  console.log(JSON.stringify({ patientId: patient.id, reportId: report.id, fileId: file.id, relPath }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
