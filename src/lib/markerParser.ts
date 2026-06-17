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

/** A number, optionally glued to a unit: "73", "73mm", "145mg/dl", "6.5%". */
const NUM_UNIT_RE = new RegExp(`^(-?\\d+(?:\\.\\d+)?)(${UNIT_ALT})?$`, 'i')

/**
 * Find the result value (and its unit) in the text that precedes the reference
 * range. Scans right-to-left and PREFERS a number that carries a unit — either
 * glued ("73mm") or followed by a unit token ("73 mm") — over a bare number
 * buried in the test name (e.g. the "1" in "ESR (1 Hour)"). Only if no number
 * has a unit anywhere does it fall back to the last bare number.
 *
 * Returns the matched token index so callers can split off the name to its left.
 */
function extractValueUnit(region: string): { value: number | null; unit: string | null; index: number } {
  const toks = region.trim().split(' ').filter(Boolean)

  // Pass 1: a number that carries a unit (glued, or with the unit as next token).
  for (let i = toks.length - 1; i >= 0; i--) {
    const glued = toks[i].match(NUM_UNIT_RE)
    if (glued && glued[2]) {
      return { value: parseFloat(glued[1]), unit: prettifyUnit(glued[2].toLowerCase()), index: i }
    }
    if (PURE_NUMBER_RE.test(toks[i])) {
      const next = toks[i + 1]
      if (next && SINGLE_UNIT_RE.test(next)) {
        return { value: parseFloat(toks[i]), unit: prettifyUnit(next), index: i }
      }
    }
  }

  // Pass 2: no unit found anywhere — take the last bare number before the range.
  for (let i = toks.length - 1; i >= 0; i--) {
    if (PURE_NUMBER_RE.test(toks[i])) {
      return { value: parseFloat(toks[i]), unit: null, index: i }
    }
  }
  return { value: null, unit: null, index: -1 }
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

// ── Qualitative free-text sections ──────────────────────────────────────────
// Some report sections are pure prose with no numeric values — a peripheral
// blood smear, a bone-marrow study, etc. They print a section header, then a
// few labelled sub-findings (RBCs / WBCs / Platelets / Impression), each a
// sentence or two that often wraps across reconstructed lines. We capture each
// labelled sub-finding as a value-less qualitative candidate so they're saved
// and shown like "Peripheral Smear — RBCs : Normocytic normochromic …".

/** A line that opens a qualitative findings section (matched on normalised text). */
const QUAL_SECTION_RE =
  /^(?:peripheral\s+(?:blood\s+)?smear(?:\s+(?:examination|study|report))?|smear\s+examination|bone\s+marrow(?:\s+(?:examination|study|aspirate))?)\b/i

/** A short sub-label inside such a section, plus any trailing separators. Whether
 *  it's really a new sub-label (vs a wrapped continuation that merely starts with
 *  "RBCs seen…") is decided in code by checking the following char's CASE — which
 *  can't be done in this regex because the /i flag would make [A-Z] match lowercase. */
const SECTION_LABEL_RE =
  /^(rbcs?|red(?:\s+blood)?\s+cells?|wbcs?|white(?:\s+blood)?\s+cells?|platelets?|plt|impression|morphology|differential(?:\s+count)?|interpretation|conclusion|advice|remarks?|comments?|notes?|findings?)\b[\s:.\-–—]*/i

/** Markers that a qualitative section has ended (end-of-report rules / dividers). */
const SECTION_END_RE = /(?:\*{2,}|end of (?:the )?report|^[-_]{3,}$)/i

/** Strong, unambiguous qualitative result phrases for standalone (non-section)
 *  rows like "CRYOGLOBULINS (QUALITATIVE) ASSAY  Not detected". Deliberately
 *  narrow (no "normal/present/seen") to avoid catching prose. */
const QUAL_STANDALONE_RE =
  /\b(not\s+detected|detected|positive|negative|reactive|non[\s-]?reactive|no\s+growth|sterile|not\s+isolated|isolated)\b/i

/** Title for the section, from its (raw) header line. */
function sectionTitleFrom(raw: string): string {
  return /bone\s+marrow/i.test(raw) ? 'Bone Marrow' : 'Peripheral Smear'
}

/** Pretty-print a matched sub-label: RBCs/WBCs/Platelets stay conventional, rest Title Case. */
function prettyLabel(s: string): string {
  const t = s.trim().toLowerCase()
  if (/^rbc|^red/.test(t)) return 'RBCs'
  if (/^wbc|^white/.test(t)) return 'WBCs'
  if (/^plt|^platelet/.test(t)) return 'Platelets'
  return t.replace(/\b\w/g, (m) => m.toUpperCase())
}

/** True if a line looks like tabular numeric data (value + range/unit) — i.e.
 *  the qualitative section is over and we're back to ordinary markers. */
function looksLikeNumericRow(norm: string): boolean {
  if (RANGE_RE.test(norm)) return true
  return UNIT_RE.test(norm) && /\d/.test(norm)
}

/**
 * Capture a qualitative section starting at its header line. Walks forward,
 * turning each labelled sub-finding into a value-less qualitative candidate and
 * folding wrapped continuation lines into the current finding. Stops at an
 * end-of-report marker, another section header, or (when no finding is open) a
 * numeric data row. Returns the captured candidates and the index of the last
 * line consumed (the line that stopped us is left for the main loop to handle).
 */
function captureQualSection(
  lines: string[],
  headerIdx: number
): { items: Array<Omit<ParsedCandidate, 'sourceText'> & { sourceText: string }>; nextIdx: number } {
  const sectionTitle = sectionTitleFrom(lines[headerIdx])
  const items: Array<Omit<ParsedCandidate, 'sourceText'> & { sourceText: string }> = []
  const MAX_LINES = 16 // safety budget so a malformed report can't run away
  let current: { name: string; parts: string[]; source: string } | null = null

  const flush = () => {
    if (!current) return
    const text = current.parts.join(' ').replace(/\s+/g, ' ').trim()
    if (text) {
      items.push({
        markerKey: null,
        markerName: current.name,
        suggestedValue: null,
        suggestedValueText: text.slice(0, 400),
        suggestedUnit: null,
        suggestedReferenceLow: null,
        suggestedReferenceHigh: null,
        confidence: 'medium',
        sourceText: current.source.slice(0, 200),
      })
    }
    current = null
  }

  let i = headerIdx + 1
  for (; i < lines.length && i <= headerIdx + MAX_LINES; i++) {
    const raw = stripLeadingSerial(lines[i].trim())
    if (!raw) continue
    const norm = normalise(raw)

    // A real sub-label is the label word followed by a sub-finding that starts
    // with a capital/digit/paren (checked case-sensitively). A wrapped line like
    // "RBCs seen…" matches the label word but is followed by lowercase → it's a
    // continuation of the previous finding, not a new one.
    const labelMatch = raw.match(SECTION_LABEL_RE)
    const rest = labelMatch ? raw.slice(labelMatch[0].length) : ''
    const isNewLabel = !!labelMatch && (rest === '' || /^[A-Z0-9(]/.test(rest))

    if (isNewLabel) {
      // A labelled sub-finding — always part of the section, even if it happens
      // to contain a number (e.g. an absolute count inside the Impression text).
      flush()
      current = {
        name: `${sectionTitle} — ${prettyLabel(labelMatch![1])}`,
        parts: rest.trim() ? [rest.trim()] : [],
        source: raw,
      }
      continue
    }

    // Not a new label: a continuation of the current finding, or the section's end.
    if (SECTION_END_RE.test(raw) || QUAL_SECTION_RE.test(norm)) break
    if (!current && looksLikeNumericRow(norm)) break

    if (current) current.parts.push(raw)
    // else: stray unlabelled line before any sub-label — ignore it.
  }

  flush()
  return { items, nextIdx: i - 1 }
}

/**
 * Standalone qualitative row (not inside a section): a test name followed by a
 * strong result phrase and no numeric value — e.g. "CRYOGLOBULINS (QUALITATIVE)
 * ASSAY  Not detected". Captured as a value-less qualitative candidate. Kept
 * conservative (strong phrases only, must sit at the end of the line) so it
 * doesn't fire on ordinary prose.
 */
function genericQualitativeRow(
  rawLine: string,
  normLine: string
): Omit<ParsedCandidate, 'sourceText'> | null {
  if (META_RE.test(normLine)) return null
  if (firstValue(normLine) !== null) return null // has a number → not purely qualitative
  const m = rawLine.match(QUAL_STANDALONE_RE)
  if (!m || m.index === undefined) return null

  // The phrase must be the result column: little or nothing follows it.
  const trailing = rawLine.slice(m.index + m[0].length).trim()
  if (trailing.length > 25) return null

  const name = rawLine.slice(0, m.index).replace(/[\s:,\-–—]+$/, '').trim()
  const alphaCount = (name.match(/[A-Za-z]/g) ?? []).length
  if (alphaCount < 3 || name.length < 3 || name.length > 60) return null
  if (name.split(/\s+/).length > 7) return null // a test name, not a sentence

  const value = rawLine.slice(m.index).trim()
  return {
    markerKey: null,
    markerName: name,
    suggestedValue: null,
    suggestedValueText: value.charAt(0).toUpperCase() + value.slice(1),
    suggestedUnit: null,
    suggestedReferenceLow: null,
    suggestedReferenceHigh: null,
    confidence: 'low',
  }
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

  // Value (+ unit) from the right, preferring a number that carries a unit over
  // a digit buried in the test name — e.g. "ESR (1 Hour) … 73mm 12-20" → 73 mm,
  // not 1. Handles the unit glued to the number ("73mm") or as the next token.
  const { value, unit, index: valueIdx } = extractValueUnit(region)
  if (value === null || valueIdx === -1) return null

  // Name = everything before the value token; must carry real letters.
  const toks = region.split(' ')
  let name = toks.slice(0, valueIdx).join(' ').trim()
  name = name.replace(TRAILING_SPECIMEN_RE, '').trim()
  const alphaCount = (name.match(/[a-z]/g) ?? []).length
  if (alphaCount < 3 || name.length < 3 || name.length > 48) return null
  if (!/[a-z]{3,}/.test(name)) return null

  // Prefer the original (cased, punctuated) name for display. Cut rawLine just
  // before the value — searching only the part before the reference range, so a
  // value that recurs inside the range (e.g. 20 in "12 - 20") can't fool us.
  const numStr = String(value)
  const rawRange = rawLine.match(RANGE_RE)
  const rawRegion = rawRange && rawRange.index !== undefined ? rawLine.slice(0, rawRange.index) : rawLine
  const cut = rawRegion.lastIndexOf(numStr)
  let displayName = cut > 2 ? rawLine.slice(0, cut).trim() : name
  displayName = displayName.replace(/[\s:,\-–—(]+$/, '').replace(TRAILING_SPECIMEN_RE, '').trim()
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

    // Qualitative free-text section (peripheral smear, bone marrow): capture its
    // labelled sub-findings as value-less candidates and skip past the lines we
    // consumed. Done before alias matching so the section's prose isn't mined
    // for spurious numeric markers.
    if (QUAL_SECTION_RE.test(normLine) && firstValue(normLine) === null) {
      const { items, nextIdx } = captureQualSection(lines, lineIdx)
      for (const it of items) candidates.push(it)
      lineIdx = nextIdx
      continue
    }

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
      }

      // Prefer the unit actually printed on the PDF over the dictionary's
      // defaultUnit (e.g. "Neutrophils 58.8 % 40-80" → "%", not the LOINC
      // absolute-count default "10*3/µL").
      let pdfUnit: string | null = null

      if (def.valueType !== 'ordinal' && def.valueType !== 'qualitative') {
        // Numeric — read the value (+ its unit) from the RIGHT, preferring a
        // number that carries a unit over a digit buried in the test name. So
        // "ESR (1 Hour) … 73mm 12-20" → 73 mm, not 1.
        const vu = extractValueUnit(beforeRange)
        value = vu.value
        pdfUnit = vu.unit
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

    // No dictionary marker claimed this row — try the generic numeric extractor
    // (C3, C4, anything), then a conservative standalone-qualitative extractor
    // (e.g. "… ASSAY  Not detected"), so unknown rows are still captured.
    if (!matched) {
      const generic = genericRow(line, normLine)
      if (generic) {
        candidates.push({ ...generic, sourceText: line.slice(0, 200) })
      } else {
        const qual = genericQualitativeRow(line, normLine)
        if (qual) candidates.push({ ...qual, sourceText: line.slice(0, 200) })
      }
    }
  }

  return candidates
}
