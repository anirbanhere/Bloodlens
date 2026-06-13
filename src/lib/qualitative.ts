// Ordinal scale for semi-quantitative dipstick results (e.g. urine protein).
// Stores both a numeric ordinal (for trending) and the original display label.
// Factual, non-diagnostic.

export interface OrdinalParse {
  ordinal: number | null
  label: string
}

// Map normalised text -> ordinal value. Order matters only for documentation.
const ORDINAL_MAP: Array<{ test: RegExp; ordinal: number; label: string }> = [
  { test: /^(negative|nil|absent|none|nad)$/i, ordinal: 0, label: 'Negative' },
  { test: /^(trace|tr)$/i, ordinal: 0.5, label: 'Trace' },
  { test: /^(\+{4}|4\s*\+|4\+)$/i, ordinal: 4, label: '4+' },
  { test: /^(\+{3}|3\s*\+|3\+)$/i, ordinal: 3, label: '3+' },
  { test: /^(\+{2}|2\s*\+|2\+)$/i, ordinal: 2, label: '2+' },
  { test: /^(\+{1}|1\s*\+|1\+)$/i, ordinal: 1, label: '1+' },
  { test: /^(positive|present|pos|detected)$/i, ordinal: 1, label: 'Positive' },
]

/** Ordered options for a dipstick dropdown in the manual-entry UI. */
export const ORDINAL_OPTIONS: Array<{ label: string; ordinal: number }> = [
  { label: 'Negative', ordinal: 0 },
  { label: 'Trace', ordinal: 0.5 },
  { label: '1+', ordinal: 1 },
  { label: '2+', ordinal: 2 },
  { label: '3+', ordinal: 3 },
  { label: '4+', ordinal: 4 },
]

/**
 * Parse the first dipstick-style token out of a text fragment.
 * Returns { ordinal, label } — ordinal is null if nothing recognised.
 */
export function parseOrdinal(text: string): OrdinalParse {
  for (const token of text.trim().split(/\s+/)) {
    const t = token.trim()
    if (!t) continue
    for (const entry of ORDINAL_MAP) {
      if (entry.test.test(t)) return { ordinal: entry.ordinal, label: entry.label }
    }
  }
  return { ordinal: null, label: '' }
}

/** Map a stored ordinal back to a label (for chart axis ticks). */
export function ordinalTick(n: number): string {
  const match = ORDINAL_OPTIONS.find((o) => o.ordinal === n)
  if (match) return match.label
  if (n === 0) return 'Neg'
  return String(n)
}
