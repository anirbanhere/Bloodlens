/**
 * Parser proof: feeds Gleneagles-style rows through parseMarkers using the FULL
 * merged dictionary (hand-curated + LOINC) and prints the candidates. Verifies
 * that C3/C4 — which the prefix-matcher misses because the lab writes
 * "COMPLEMENT 3 (C3)" not "Complement C3" — are still captured by the generic
 * row extractor, with the correct value and reference range.
 *
 *   npx tsx scripts/test_parser.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMarkers, type MarkerDef } from '../src/lib/markerParser'

// Hand-curated markers are defined in seed.ts as TS; for the test we only need a
// representative slice plus the full LOINC set to exercise both match paths.
const handCurated: MarkerDef[] = [
  { markerKey: 'creatinine', canonicalName: 'Serum Creatinine', aliases: JSON.stringify(['creatinine', 'serum creatinine']), defaultUnit: 'mg/dL', valueType: 'numeric', category: 'Kidney Function' },
  { markerKey: 'hemoglobin', canonicalName: 'Hemoglobin', aliases: JSON.stringify(['hemoglobin', 'haemoglobin', 'hb']), defaultUnit: 'g/dL', valueType: 'numeric', category: 'Anemia / Blood' },
]

const loinc = JSON.parse(
  readFileSync(join(__dirname, '..', 'prisma', 'markers.loinc.json'), 'utf-8')
) as Array<{ markerKey: string; canonicalName: string; aliases: string[]; defaultUnit: string | null; valueType: string; category: string }>

const defs: MarkerDef[] = [
  ...handCurated,
  ...loinc.map((m) => ({
    markerKey: m.markerKey,
    canonicalName: m.canonicalName,
    aliases: JSON.stringify(m.aliases),
    defaultUnit: m.defaultUnit,
    valueType: m.valueType,
    category: m.category,
  })),
]

// Representative reconstructed rows from the Gleneagles biochemistry report,
// plus a couple of known markers and noise lines that must NOT become candidates.
const sample = [
  'Dr. A. Sharma, MD Pathology',
  'Patient Name: XXXX        Age: 57 Years    Sex: Male',
  'Sample Collected: 12-06-2026',
  'TEST                          RESULT     UNIT       REFERENCE',
  'COMPLEMENT 3 (C3), SERUM        145      mg/dl      90 - 180',
  'COMPLEMENT 4 (C4), SERUM         28      mg/dl      10 - 40',
  'CREATININE, SERUM               0.9      mg/dl      0.7 - 1.3',
  'HAEMOGLOBIN                     13.5     g/dl       13 - 17',
  'IMMUNOGLOBULIN G (IgG), SERUM   1100     mg/dl      700 - 1600',
  'Page 1 of 2',
  '*** End of Report ***',
].join('\n')

const candidates = parseMarkers(sample, defs)

console.log(`\n${candidates.length} candidates:\n`)
for (const c of candidates) {
  const range = c.suggestedReferenceLow !== null ? `${c.suggestedReferenceLow}-${c.suggestedReferenceHigh}` : '—'
  const key = c.markerKey ?? '(generic)'
  console.log(
    `  ${String(c.suggestedValue ?? c.suggestedValueText ?? '—').padStart(6)} | ${String(c.suggestedUnit ?? '—').padEnd(7)} | ref ${range.padEnd(9)} | ${c.confidence.padEnd(6)} | ${key.padEnd(22)} | ${c.markerName}`
  )
}

const c3 = candidates.find((c) => /complement 3|c3/i.test(c.markerName))
const c4 = candidates.find((c) => /complement 4|c4/i.test(c.markerName))
console.log('\nC3 captured:', c3 ? `YES (value=${c3.suggestedValue}, ref=${c3.suggestedReferenceLow}-${c3.suggestedReferenceHigh})` : 'NO')
console.log('C4 captured:', c4 ? `YES (value=${c4.suggestedValue}, ref=${c4.suggestedReferenceLow}-${c4.suggestedReferenceHigh})` : 'NO')
const noise = candidates.find((c) => /page|end of report|patient|sample/i.test(c.markerName))
console.log('Noise leaked:', noise ? `YES -> "${noise.markerName}"` : 'no')
