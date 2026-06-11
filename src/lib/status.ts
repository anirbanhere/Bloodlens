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

export const STATUS_LABELS: Record<MarkerStatus, string> = {
  high: 'Above range',
  low: 'Below range',
  normal: 'In range',
  unknown: '—',
}

// Tailwind classes for status badges/cells
export const STATUS_CLASSES: Record<MarkerStatus, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  low: 'bg-amber-50 text-amber-700 border-amber-200',
  normal: 'bg-green-50 text-green-700 border-green-200',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
}
