/**
 * Parses reconstructed text rows (from PDF or OCR) against the marker dictionary.
 * Each row is parsed left-to-right: the test name anchors the start of the row,
 * the result value comes next, then the reference range. Returns candidates —
 * the user must review and confirm before anything is saved.
 */

import { parseOrdinal } from './qualitative'

export interface ParsedCandidate {
  markerKey: string | null
  markerName: string
  suggestedValue: number | null
  suggestedValueText: string | null
  suggestedUnit: string | null
  suggestedReferenceLow: number | null
  suggestedReferenceHigh: number | null
  confidence: 'high' | 'medium' | 'low'
  sourceText: string
}

export interface MarkerDef {
  markerKey: string
  canonicalName: string
  aliases: string // JSON array
  defaultUnit: string | null
  valueType: string // numeric | ordinal | qualitative
  category: string
}

const MICROSCOPY_CATEGORY = 'Urine Microscopy'

/**
 * Normalise a string for matching while preserving the characters that matter
 * for numbers and ranges: digits, dot, hyphen, slash, percent, micro sign.
 * Also strips thousands separators (2,50,000 -> 250000) and unifies dashes.
 */
function normalise(s: string): string {
  return s
    .replace(/[‒-―]/g, '-') // figure/en/em dashes -> hyphen
    .replace(/(\d),(\d)/g, '$1$2') // thousands separators
    .toLowerCase()
    .replace(/[^a-z0-9.%/µ+\- ]/g, ' ') // keep '+' for dipstick results (+, ++, +++)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Remove a leading serial number like "1." or "12)" from a row. */
function stripLeadingSerial(line: string): string {
  return line.replace(/^\s*\d{1,3}\s*[.)]\s+/, '')
}

const RANGE_RE = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/
const PURE_NUMBER_RE = /^-?\d+(?:\.\d+)?$/

/** Recognised lab unit tokens — used to anchor the generic extractor and to
 *  read the unit that sits between the value and the reference range. */
const UNIT_ALT =
  '%|mg\\/d?l|g\\/d?l|mg\\/l|g\\/l|mmol\\/l|µmol\\/l|umol\\/l|mol\\/l|meq\\/l|u\\/l|iu\\/l|miu\\/l|µiu\\/ml|uiu\\/ml|ng\\/ml|pg\\/ml|ng\\/dl|µg\\/dl|ug\\/dl|µg\\/l|ug\\/l|fl|pg|mm\\/hr|mm|cells\\/µl|cells\\/ul|cells\\/mm3|cells\\/mm³|million\\/µl|million\\/ul|lakh\\/µl|\\/hpf|\\/µl|\\/ul|\\/mm3|\\/mm³'
const UNIT_RE = new RegExp(`(?:^| )(?:${UNIT_ALT})(?: |$)`)
const SINGLE_UNIT_RE = new RegExp(`^(?:${UNIT_ALT})$`)

/** Restore conventional casing on a normalised (lowercased) unit token. */
function prettifyUnit(u: string): string {
  return u
    .replace(/\/dl$/, '/dL')
    .replace(/\/l$/, '/L')
    .replace(/\/ml$/, '/mL')
    .replace(/^iu/, 'IU')
    .replace(/^miu/, 'mIU')
    .replace(/^uiu/, 'µIU')
    .replace(/ul$/, 'µL')
    .replace(/mm3$/, 'mm³')
    .replace(/^u\//, 'U/')
}

/** Header/footer/metadata keywords — generic rows containing these are skipped. */
const META_RE = /\b(?:age|years|yrs|d\.?o\.?b|date|page|phone|mobile|sample|specimen|collected|received|registered|reported|report|patient|name|sex|gender|referred|ref by|reg no|uhid|mrn|barcode|address|lab no|accession|method|comment|comments|interpretation|signature|verified|technologist|consultant)\b/

/** A trailing specimen word adds nothing to a marker name; trim it for display. */
const TRAILING_SPECIMEN_RE = /[\s,]+(?:serum|plasma|ser\/plas|blood|whole blood|urine|csf)\s*$/i

/** First standalone numeric token in a string. */
function firstValue(text: string): number | null {
  for (const tok of text.split(' ')) {
    if (PURE_NUMBER_RE.test(tok)) {
      const n = parseFloat(tok)
      if (isFinite(n)) return n
    }
  }
  return null
}

/** Last standalone numeric token in a string.
 *  Used for dictionary matches: the value is the last number before the range,
 *  because test names can contain digits (e.g. "ESR (1 Hour) … 73 mm 12-20"
 *  must yield 73, not 1). */
function lastValue(text: string): number | null {
  const toks = text.split(' ')
  for (let i = toks.length - 1; i >= 0; i--) {
    if (PURE_NUMBER_RE.test(toks[i])) {
      const n = parseFloat(toks[i])
      if (isFinite(n)) return n
    }
  }
  return null
}

/**
 * Generic row extractor — the safety net for tests NOT in the dictionary.
 *
 * A dictionary will never cover the long tail (C3, C4, niche assays), and every
 * lab spells names differently. So any row shaped `name … value … [unit] [range]`
 * is captured as an UNKNOWN candidate (markerKey = null) for the user to confirm,
 * rather than dropped. The dictionary's job is to *enrich* recognised rows, never
 * to gate extraction.
 *
 * The value is read from the RIGHT (the number just before the reference range /
 * unit), because test names themselves contain digits — e.g. "COMPLEMENT 3 (C3),
 * SERUM 145 mg/dl 90 - 180" must yield name="Complement 3 (C3), Serum", value=145,
 * not name="Complement", value=3.
 */
function genericRow(
  rawLine: string,
  normLine: string
): Omit<ParsedCandidate, 'sourceText'> | null {
  if (META_RE.test(normLine)) return null

  // Reference range first; the value sits just before it.
  let refLow: number | null = null
  let refHigh: number | null = null
  let region = normLine
  const rangeMatch = normLine.match(RANGE_RE)
  if (rangeMatch && rangeMatch.index !== undefined) {
    const lo = parseFloat(rangeMatch[1])
    const hi = parseFloat(rangeMatch[2])
    if (isFinite(lo) && isFinite(hi) && lo < hi) {
      refLow = lo
      refHigh = hi
      region = normLine.slice(0, rangeMatch.index)
    }
  }

  const hasUnit = UNIT_RE.test(normLine)
  // Need an anchor: a reference range or a recognised unit. Otherwise a bare
  // "name number" line is too ambiguous to trust (could be an ID, age, etc.).
  if (refLow === null && !hasUnit) return null

  // Value = last standalone number in the region before the range.
  const toks = region.split(' ')
  let valueIdx = -1
  for (let i = toks.length - 1; i >= 0; i--) {
    if (PURE_NUMBER_RE.test(toks[i])) { valueIdx = i; break }
  }
  if (valueIdx === -1) return null
  const value = parseFloat(toks[valueIdx])
  if (!isFinite(value)) return null

  // Unit, if any, sits in the token immediately after the value ("145 mg/dl").
  let unit: string | null = null
  const afterTok = toks[valueIdx + 1]
  if (afterTok && SINGLE_UNIT_RE.test(afterTok)) unit = prettifyUnit(afterTok)

  // Name = everything before the value token; must carry real letters.
  let name = toks.slice(0, valueIdx).join(' ').trim()
  name = name.replace(TRAILING_SPECIMEN_RE, '').trim()
  const alphaCount = (name.match(/[a-z]/g) ?? []).length
  if (alphaCount < 3 || name.length < 3 || name.length > 48) return null
  if (!/[a-z]{3,}/.test(name)) return null

  // Prefer the original (cased, punctuated) name for display.
  const valTok = toks[valueIdx]
  const idx = rawLine.indexOf(valTok)
  let displayName = idx > 2 ? rawLine.slice(0, idx).trim() : name
  displayName = displayName.replace(/[\s:,\-]+$/, '').replace(TRAILING_SPECIMEN_RE, '').trim()
  if (displayName.length < 3 || displayName.length > 60) displayName = name

  return {
    markerKey: null,
    markerName: displayName,
    suggestedValue: value,
    suggestedValueText: null,
    suggestedUnit: unit,
    suggestedReferenceLow: refLow,
    suggestedReferenceHigh: refHigh,
    confidence: refLow !== null ? 'medium' : 'low',
  }
}

/**
 * Build a lookup of normalised alias -> definition, longest aliases first
 * so "blood urea nitrogen" wins over "urea".
 */
function buildAliasMap(defs: MarkerDef[]): Array<{ alias: string; def: MarkerDef }> {
  const entries: Array<{ alias: string; def: MarkerDef }> = []
  for (const def of defs) {
    let aliases: string[] = []
    try { aliases = JSON.parse(def.aliases) } catch { aliases = [def.canonicalName] }
    for (const a of aliases) {
      const alias = normalise(a)
      if (alias) entries.push({ alias, def })
    }
  }
  return entries.sort((a, b) => b.alias.length - a.alias.length)
}

/**
 * Does `normLine` begin with `alias` at a word boundary?
 * Prevents "k" (potassium) from matching "ketone", "na" from matching "name", etc.
 */
function startsWithAlias(normLine: string, alias: string): boolean {
  if (!normLine.startsWith(alias)) return false
  const after = normLine[alias.length]
  // End of string, or a separator/digit follows — not another letter.
  return after === undefined || after === ' '
}

export function parseMarkers(rawText: string, definitions: MarkerDef[]): ParsedCandidate[] {
  const aliasMap = buildAliasMap(definitions)
  const lines = rawText.split('\n')
  const candidates: ParsedCandidate[] = []
  const seenKeys = new Set<string>()

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx]
    const line = stripLeadingSerial(rawLine.trim())
    if (!line) continue
    const normLine = normalise(line)
    const nextNorm = normalise(lines[lineIdx + 1] ?? '')

    // "/hpf" (per high-power field) marks a urine-microscopy count row. Such
    // rows only match microscopy markers; everywhere else, microscopy markers
    // are excluded — this resolves the urine-vs-blood WBC/RBC alias collision.
    const isMicroscopyRow = normLine.includes('hpf')

    let matched = false
    for (const { alias, def } of aliasMap) {
      const isMicroscopyDef = def.category === MICROSCOPY_CATEGORY
      if (isMicroscopyRow !== isMicroscopyDef) continue
      if (!startsWithAlias(normLine, alias)) continue
      if (def.markerKey && seenKeys.has(def.markerKey)) break

      // Everything to the right of the test name holds value + unit + range.
      const rest = normLine.slice(alias.length).trim()

      // Reference range comes after the value in tabular layout — find it first,
      // then search for the value only in the text that precedes it.
      let refLow: number | null = null
      let refHigh: number | null = null
      let beforeRange = rest
      const rangeMatch = rest.match(RANGE_RE)
      if (rangeMatch && rangeMatch.index !== undefined) {
        const lo = parseFloat(rangeMatch[1])
        const hi = parseFloat(rangeMatch[2])
        if (isFinite(lo) && isFinite(hi) && lo < hi) {
          refLow = lo
          refHigh = hi
          beforeRange = rest.slice(0, rangeMatch.index)
        }
      }

      let value: number | null = null
      let valueText: string | null = null
      let confidence: 'high' | 'medium' | 'low' = 'low'

      if (def.valueType === 'ordinal') {
        // Dipstick: map Negative/Trace/1+..4+ to an ordinal; ignore numeric range.
        const { ordinal, label } = parseOrdinal(rest)
        refLow = null
        refHigh = null
        if (ordinal !== null) {
          value = ordinal
          valueText = label
          confidence = 'high'
        } else {
          // Fallback: a bare numeric reading (or a mis-classified serum value).
          const n = firstValue(beforeRange)
          if (n !== null) { value = n; confidence = 'medium' }
        }
      } else if (def.valueType === 'qualitative') {
        // Descriptive result (colour, clarity, "Not detected", "Positive" …):
        // capture up to 5 words, stopping at the first digit. This handles
        // single-word ("Negative"), two-word ("Not detected"), and short phrases
        // ("Normocytic normochromic RBCs") while ignoring trailing numeric noise.
        refLow = null
        refHigh = null
        const words = rest.split(' ').filter((t) => t.length > 0)
        const phrase: string[] = []
        for (const w of words) {
          if (/\d/.test(w) || phrase.length >= 5) break
          phrase.push(w)
        }
        const raw = phrase.join(' ')
        if (raw) {
          valueText = raw.charAt(0).toUpperCase() + raw.slice(1)
          confidence = 'medium'
        }
      } else {
        // Numeric — read value from the RIGHT (last number before the range) so
        // that test names containing digits don't steal the result. Example:
        // "ESR (1 Hour) (Modified Westergren Method) 73 mm 12-20" → value=73,
        // not value=1. Mirrors the same decision in genericRow.
        value = lastValue(beforeRange)
        // Wrapped layout: a long test name pushes the value onto the next line
        // (e.g. "TSH-THYROID STIMULATING HORMONE," then "2.71 uIU/mL"). If this
        // row had no value but the next line begins with a number, borrow it.
        if (value === null) {
          const wrapped = nextNorm.match(/^(-?\d+(?:\.\d+)?)\b/)
          if (wrapped) value = parseFloat(wrapped[1])
        }
        if (value !== null && refLow !== null) confidence = 'high'
        else if (value !== null) confidence = 'medium'
      }

      // Prefer the unit actually printed on the PDF over the dictionary's defaultUnit.
      // Example: "Neutrophils 58.8 % 40-80" should yield "%" not the LOINC defaultUnit
      // "10*3/µL" (which is for the absolute-count variant of the same marker).
      // Scan right-to-left (matches the lastValue direction) to find the value
      // token, then take the token immediately after it as the unit.
      let pdfUnit: string | null = null
      if (value !== null) {
        const brToks = beforeRange.trim().split(' ')
        for (let i = brToks.length - 1; i >= 0; i--) {
          if (PURE_NUMBER_RE.test(brToks[i]) && Math.abs(parseFloat(brToks[i]) - value) < 1e-9) {
            const tok = brToks[i + 1]
            if (tok && SINGLE_UNIT_RE.test(tok)) { pdfUnit = prettifyUnit(tok); break }
          }
        }
      }

      candidates.push({
        markerKey: def.markerKey,
        markerName: def.canonicalName,
        suggestedValue: value,
        suggestedValueText: valueText,
        suggestedUnit: pdfUnit ?? def.defaultUnit ?? null,
        suggestedReferenceLow: refLow,
        suggestedReferenceHigh: refHigh,
        confidence,
        sourceText: line.slice(0, 200),
      })

      if (def.markerKey) seenKeys.add(def.markerKey)
      matched = true
      break // one marker per row
    }

    // No dictionary marker claimed this row — try the generic extractor so
    // unknown tests (C3, C4, anything) are still captured for user review.
    if (!matched) {
      const generic = genericRow(line, normLine)
      if (generic) {
        candidates.push({ ...generic, sourceText: line.slice(0, 200) })
      }
    }
  }

  return candidates
}
