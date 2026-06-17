/**
 * Parser proof for qualitative (value-less) capture:
 *   1. A peripheral-smear section — header + labelled sub-findings, including a
 *      WRAPPED continuation line that starts with "RBCs seen…" (must NOT be
 *      mistaken for a new RBCs label) and an Impression line that contains a
 *      number (must stay part of the section, not terminate it).
 *   2. ESR with a digit in its name ("ESR (1 Hour) … 73 mm 12-20" → 73, not 1).
 *   3. A standalone qualitative assay ("CRYOGLOBULINS (QUALITATIVE) ASSAY
 *      Not detected") captured with no numeric value.
 *
 *   npx tsx scripts/test_qualitative.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMarkers, type MarkerDef } from '../src/lib/markerParser'

const handCurated: MarkerDef[] = [
  { markerKey: 'esr', canonicalName: 'ESR', aliases: JSON.stringify(['esr', 'erythrocyte sedimentation rate']), defaultUnit: 'mm/hr', valueType: 'numeric', category: 'Inflammation' },
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

// Reconstructed rows mirroring the two real reports (note the wrapped RBCs line).
const sample = [
  'DEPARTMENT OF HEMATOLOGY',
  'SAMPLE NO: 8030043259    SAMPLE TYPE: Whole blood-EDTA',
  'TEST DESCRIPTION WITH METHODOLOGY    RESULT    UNIT    BIOLOGICAL REF.INTERVAL',
  'ESR (1 Hour) (Modified Westergren Method) 73 mm 12-20',
  'Manual - Westergrens method',
  // A non-dictionary marker with a digit in its NAME and the value glued to its
  // unit ("73mm") — reproduces the real-report bug on the generic path, where
  // the naive "last bare number" would wrongly pick the "1" in "(1 Hour)".
  'SOME NOVEL TEST (1 Hour Westergren) 73mm 12-20',
  'PERIPHERAL SMEAR EXAMINATION',
  'RBCs Normocytic normochromic RBCs. No schistocytes/ nucleated',
  'RBCs seen. No Haemoparasites seen.',
  'WBCs Normal in total count with mild absolute eosinophilia. No',
  'immature cells/ blast cells seen.',
  'PLATELETs Adequate with normal morphology.',
  'IMPRESSION Mild absolute eosinophilia (absolute eosinophil count - 1410 cells/ cu.mm).',
  '*** End Of The Report ***',
  'CRYOGLOBULINS (QUALITATIVE) ASSAY    Not detected',
].join('\n')

const candidates = parseMarkers(sample, defs)

console.log(`\n${candidates.length} candidates:\n`)
for (const c of candidates) {
  const range = c.suggestedReferenceLow !== null ? `${c.suggestedReferenceLow}-${c.suggestedReferenceHigh}` : '—'
  const val = c.suggestedValue ?? c.suggestedValueText ?? '—'
  console.log(
    `  ${c.confidence.padEnd(6)} | ${String(val).slice(0, 40).padEnd(40)} | ${String(c.suggestedUnit ?? '—').padEnd(6)} | ref ${range.padEnd(7)} | ${c.markerName}`
  )
}

function assert(label: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`)
  if (!cond) process.exitCode = 1
}

console.log('')
const esr = candidates.find((c) => c.markerName === 'ESR')
assert('ESR value is 73 (not 1)', esr?.suggestedValue === 73)
assert('ESR unit is mm', esr?.suggestedUnit === 'mm')
assert('ESR range 12-20', esr?.suggestedReferenceLow === 12 && esr?.suggestedReferenceHigh === 20)

// Generic path, value glued to unit ("73mm"): must read 73 + mm, not the "1" in the name.
const glued = candidates.find((c) => /novel test/i.test(c.markerName))
assert('Glued generic value is 73 (not 1)', glued?.suggestedValue === 73)
assert('Glued generic unit is mm', glued?.suggestedUnit === 'mm')
assert('Glued generic name not truncated at "("', !!glued && !glued.markerName.trim().endsWith('('))

const rbc = candidates.find((c) => c.markerName === 'Peripheral Smear — RBCs')
assert('Smear RBCs captured', !!rbc && rbc.suggestedValue === null)
assert('Smear RBCs folded the wrapped line', !!rbc?.suggestedValueText?.includes('Haemoparasites'))
assert('Smear RBCs not split into a 2nd RBCs entry',
  candidates.filter((c) => c.markerName === 'Peripheral Smear — RBCs').length === 1)

const wbc = candidates.find((c) => c.markerName === 'Peripheral Smear — WBCs')
assert('Smear WBCs captured + folded', !!wbc?.suggestedValueText?.includes('blast cells'))

const plt = candidates.find((c) => c.markerName === 'Peripheral Smear — Platelets')
assert('Smear Platelets captured', !!plt)

const imp = candidates.find((c) => c.markerName === 'Peripheral Smear — Impression')
assert('Smear Impression captured (kept despite containing 1410)', !!imp && imp.suggestedValue === null)

const cryo = candidates.find((c) => /cryoglobulins/i.test(c.markerName))
assert('Cryoglobulins captured as qualitative', !!cryo && cryo.suggestedValue === null && /not detected/i.test(cryo.suggestedValueText ?? ''))

const noise = candidates.find((c) => /end of|sample|department|methodology/i.test(c.markerName))
assert('No noise leaked', !noise)
