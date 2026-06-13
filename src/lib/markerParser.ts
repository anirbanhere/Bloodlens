/**
 * Parses raw text (from PDF or OCR) against the marker definition dictionary.
 * Returns candidate markers — user must review and confirm before they're saved.
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

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9%/µ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Parse a numeric value from a token, returning null if not a number. */
function parseNum(token: string): number | null {
  const cleaned = token.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return isFinite(n) ? n : null
}

/**
 * Looks for a reference range pattern like "3.5 - 5.0" or "(3.5-5.0)" or "3.5–5.0"
 * in a string. Returns [low, high] or null.
 */
function parseRefRange(text: string): [number, number] | null {
  const match = text.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/)
  if (!match) return null
  const low = parseFloat(match[1])
  const high = parseFloat(match[2])
  if (!isFinite(low) || !isFinite(high) || low >= high) return null
  return [low, high]
}

/** Tokenise a line into whitespace-separated tokens. */
function tokenise(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean)
}

/**
 * Builds a lookup map: normalised alias → marker definition.
 * Longer aliases take priority (matched first via sort).
 */
function buildAliasMap(defs: MarkerDef[]): Array<{ alias: string; def: MarkerDef }> {
  const entries: Array<{ alias: string; def: MarkerDef }> = []
  for (const def of defs) {
    let aliases: string[] = []
    try { aliases = JSON.parse(def.aliases) } catch { aliases = [def.canonicalName] }
    for (const a of aliases) {
      entries.push({ alias: normalise(a), def })
    }
  }
  // Longer aliases first so "blood urea nitrogen" matches before "urea"
  return entries.sort((a, b) => b.alias.length - a.alias.length)
}

export function parseMarkers(rawText: string, definitions: MarkerDef[]): ParsedCandidate[] {
  const aliasMap = buildAliasMap(definitions)
  const lines = rawText.split('\n')
  const candidates: ParsedCandidate[] = []
  const seenKeys = new Set<string>()

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    const normLine = normalise(line)

    // Try each alias against the normalised line
    for (const { alias, def } of aliasMap) {
      if (!normLine.includes(alias)) continue

      // Don't extract the same marker key twice from one document
      if (def.markerKey && seenKeys.has(def.markerKey)) continue

      // Gather context: current line + up to 2 surrounding lines
      const ctx = [
        lines[lineIdx - 1] ?? '',
        line,
        lines[lineIdx + 1] ?? '',
        lines[lineIdx + 2] ?? '',
      ].join(' ')

      const tokens = tokenise(ctx)

      // Find a numeric value near the match
      let value: number | null = null
      let unit: string | null = def.defaultUnit ?? null
      let refLow: number | null = null
      let refHigh: number | null = null

      for (let t = 0; t < tokens.length; t++) {
        const n = parseNum(tokens[t])
        if (n !== null && value === null) {
          value = n
        }
      }

      // Try to find a reference range anywhere in the context
      const refMatch = parseRefRange(ctx)
      if (refMatch) {
        [refLow, refHigh] = refMatch
        // If the value falls outside reference range by more than 10x, it's probably the range itself — skip
        if (value !== null && refLow !== null && refHigh !== null) {
          if (value === refLow || value === refHigh) value = null
        }
      }

      // Confidence
      let confidence: 'high' | 'medium' | 'low'
      if (value !== null && unit !== null) confidence = 'high'
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
        sourceText: line.trim().slice(0, 200),
      })

      if (def.markerKey) seenKeys.add(def.markerKey)
      break // One alias match per line is enough
    }
  }

  return candidates
}
