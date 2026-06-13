/**
 * Parses reconstructed text rows (from PDF or OCR) against the marker dictionary.
 * Each row is parsed left-to-right: the test name anchors the start of the row,
 * the result value comes next, then the reference range. Returns candidates —
 * the user must review and confirm before anything is saved.
 */

export interface ParsedCandidate {
  markerKey: string | null
  markerName: string
  suggestedValue: number | null
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
}

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
    .replace(/[^a-z0-9.%/µ\- ]/g, ' ')
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

  for (const rawLine of lines) {
    const line = stripLeadingSerial(rawLine.trim())
    if (!line) continue
    const normLine = normalise(line)

    // Skip microscopy / cell-count rows — "/hpf" (per high-power field) and
    // "microscopy" never appear in serum chemistry results, but their cell
    // counts can collide with blood-count marker names (e.g. urine "WBC").
    if (normLine.includes('hpf') || normLine.includes('microscopy')) continue

    for (const { alias, def } of aliasMap) {
      if (!startsWithAlias(normLine, alias)) continue
      if (def.markerKey && seenKeys.has(def.markerKey)) break

      // Everything to the right of the test name holds value + unit + range.
      const rest = normLine.slice(alias.length).trim()

      // Reference range comes after the value in tabular layout — find it first,
      // then search for the value only in the text that precedes it.
      let refLow: number | null = null
      let refHigh: number | null = null
      let valueText = rest
      const rangeMatch = rest.match(RANGE_RE)
      if (rangeMatch && rangeMatch.index !== undefined) {
        const lo = parseFloat(rangeMatch[1])
        const hi = parseFloat(rangeMatch[2])
        if (isFinite(lo) && isFinite(hi) && lo < hi) {
          refLow = lo
          refHigh = hi
          valueText = rest.slice(0, rangeMatch.index)
        }
      }

      const value = firstValue(valueText)
      const unit = def.defaultUnit ?? null

      let confidence: 'high' | 'medium' | 'low'
      if (value !== null && refLow !== null) confidence = 'high'
      else if (value !== null) confidence = 'medium'
      else confidence = 'low'

      candidates.push({
        markerKey: def.markerKey,
        markerName: def.canonicalName,
        suggestedValue: value,
        suggestedUnit: unit,
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
