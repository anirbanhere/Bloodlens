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

/** First standalone numeric token in a string (rejects dates, IDs, ages, ranges). */
function firstValue(text: string): number | null {
  for (const tok of text.split(' ')) {
    if (PURE_NUMBER_RE.test(tok)) {
      const n = parseFloat(tok)
      if (isFinite(n)) return n
    }
  }
  return null
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
        // Descriptive (colour, clarity): first token after the name is the value.
        refLow = null
        refHigh = null
        const tok = rest.split(' ').find((t) => t.length > 0) ?? ''
        if (tok) {
          valueText = tok.charAt(0).toUpperCase() + tok.slice(1)
          confidence = 'medium'
        }
      } else {
        // Numeric
        value = firstValue(beforeRange)
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

      candidates.push({
        markerKey: def.markerKey,
        markerName: def.canonicalName,
        suggestedValue: value,
        suggestedValueText: valueText,
        suggestedUnit: def.defaultUnit ?? null,
        suggestedReferenceLow: refLow,
        suggestedReferenceHigh: refHigh,
        confidence,
        sourceText: line.slice(0, 200),
      })

      if (def.markerKey) seenKeys.add(def.markerKey)
      break // one marker per row
    }
  }

  return candidates
}
