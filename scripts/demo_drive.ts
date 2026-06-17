/**
 * Drives the REAL API route handlers in-process (no server, no auth) for the
 * demo fixture created by demo_setup.ts. Proves the full data path:
 *   extract  -> persists generic C3/C4 candidates
 *   confirm  -> mints a MarkerDefinition per unknown + saves trendable results
 *
 *   npx tsx scripts/demo_drive.ts <fileId> <reportId>
 */
import { POST as extractPOST } from '../src/app/api/files/[fid]/extract/route'
import { GET as candidatesGET, PATCH as candidatesPATCH } from '../src/app/api/extractions/[eid]/candidates/route'
import { POST as confirmPOST } from '../src/app/api/extractions/[eid]/confirm/route'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import 'dotenv/config'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' })
const prisma = new PrismaClient({ adapter } as any)

const fileId = process.argv[2]
const reportId = process.argv[3]

async function main() {
  // 1. EXTRACT (real pdfjs text extraction + parseMarkers + persist)
  const exRes = await extractPOST(new Request('http://x/', { method: 'POST', body: '{}' }), {
    params: Promise.resolve({ fid: fileId }),
  })
  const ex = await exRes.json()
  console.log('extract ->', JSON.stringify(ex))
  const eid = ex.extractionId

  // 2. CANDIDATES
  const candRes = await candidatesGET(new Request('http://x/'), { params: Promise.resolve({ eid }) })
  const cands = await candRes.json()
  console.log(`\ncandidates (${cands.length}):`)
  for (const c of cands) {
    const range = c.suggestedReferenceLow !== null ? `${c.suggestedReferenceLow}-${c.suggestedReferenceHigh}` : '—'
    console.log(`  ${String(c.suggestedValue ?? '—').padStart(6)} | ${String(c.suggestedUnit ?? '—').padEnd(6)} | ref ${range.padEnd(9)} | ${(c.markerKey ?? '(generic)').padEnd(20)} | ${c.markerName}`)
  }

  // 3. ACCEPT every candidate, then CONFIRM
  for (const c of cands) {
    await candidatesPATCH(
      new Request('http://x/', { method: 'PATCH', body: JSON.stringify({ candidateId: c.id, status: 'accepted' }) }),
      { params: Promise.resolve({ eid }) }
    )
  }
  const confRes = await confirmPOST(new Request('http://x/', { method: 'POST' }), { params: Promise.resolve({ eid }) })
  console.log('\nconfirm ->', JSON.stringify(await confRes.json()))

  // 4. Saved, trendable results (incl. minted custom defs for unknowns)
  const results = await prisma.markerResult.findMany({ where: { reportId }, orderBy: { sortOrder: 'asc' } })
  console.log(`\nsaved MarkerResults (${results.length}):`)
  for (const r of results) {
    console.log(`  ${String(r.value ?? r.valueText ?? '—').padStart(6)} ${String(r.unit ?? '').padEnd(6)} | ${String(r.status ?? '—').padEnd(7)} | ${r.markerKey.padEnd(28)} | ${r.markerName}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
