// Marker status helpers shared by API routes and UI.
// Calm, factual labels only — no diagnostic language.

export type MarkerStatus = 'high' | 'low' | 'normal' | 'unknown'

export function computeStatus(
  value: number,
  referenceLow: number | null | undefined,
  referenceHigh: number | null | undefined
): MarkerStatus {
  if (referenceLow == null && referenceHigh == null) return 'unknown'
  if (referenceHigh != null && value > referenceHigh) return 'high'
  if (referenceLow != null && value < referenceLow) return 'low'
  return 'normal'
}

// Dipstick / ordinal markers: any positive reading is "above range" (e.g. proteinuria),
// a negative reading (ordinal 0) is "in range". Factual, non-diagnostic.
export function statusForOrdinal(ordinal: number | null | undefined): MarkerStatus {
  if (ordinal == null) return 'unknown'
  return ordinal > 0 ? 'high' : 'normal'
}

/**
 * Resolve status for any marker type, given its parsed value(s).
 * - numeric:     compare to reference range
 * - ordinal:     positive -> high, negative -> normal
 * - qualitative: no status (—)
 */
export function statusForType(
  valueType: string | null | undefined,
  value: number | null | undefined,
  referenceLow: number | null | undefined,
  referenceHigh: number | null | undefined
): MarkerStatus {
  if (valueType === 'qualitative') return 'unknown'
  if (valueType === 'ordinal') return statusForOrdinal(value)
  if (value == null) return 'unknown'
  return computeStatus(value, referenceLow, referenceHigh)
}

export const STATUS_LABELS: Record<MarkerStatus, string> = {
  high: 'Above range',
  low: 'Below range',
  normal: 'In range',
  unknown: '—',
}

// Tailwind classes for status badges/cells (brand palette tokens)
export const STATUS_CLASSES: Record<MarkerStatus, string> = {
  high: 'bg-alert-50 text-alert-700 border-alert-100',
  low: 'bg-warn-50 text-warn-700 border-warn-100',
  normal: 'bg-ok-50 text-ok-700 border-ok-100',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
}
