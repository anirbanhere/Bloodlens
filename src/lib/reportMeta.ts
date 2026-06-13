// Best-effort extraction of the report date from raw lab-report text.
// Returns an ISO date (YYYY-MM-DD) or null. The user can always correct it.

/**
 * Looks for a "collected"/"report"/"sample" date first, then falls back to the
 * first plausible date anywhere in the text. Accepts DD-MM-YYYY, DD/MM/YYYY,
 * and YYYY-MM-DD. Day-first is assumed for ambiguous DD-MM-YYYY (common on the
 * Indian lab reports this targets).
 */
export function extractReportDate(text: string): string | null {
  const lower = text.toLowerCase()

  // Prefer a date near a "collected"/"report"/"sample" keyword.
  const keywords = ['collected', 'report date', 'sample collected', 'reported', 'received']
  for (const kw of keywords) {
    const idx = lower.indexOf(kw)
    if (idx !== -1) {
      const window = text.slice(idx, idx + 120)
      const d = firstDate(window)
      if (d) return d
    }
  }
  // Fallback: first date anywhere.
  return firstDate(text)
}

function firstDate(s: string): string | null {
  // YYYY-MM-DD
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // DD-MM-YYYY or DD/MM/YYYY (day-first)
  const dmy = s.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    const year = dmy[3]
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`
    }
  }
  return null
}
