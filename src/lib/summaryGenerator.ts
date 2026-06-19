/**
 * Generates a structured pre-appointment summary for a patient.
 * All language is factual — no diagnostic or interpretive statements.
 */
import { prisma } from '@/lib/db'
import { statusForType } from '@/lib/status'

export interface MarkerSummaryRow {
  markerKey: string
  markerName: string
  category: string
  valueType: string // numeric | ordinal | qualitative
  unit: string | null
  latest: { value: number | null; valueText: string | null; date: string; status: string | null; referenceLow: number | null; referenceHigh: number | null } | null
  previous: { value: number | null; valueText: string | null; date: string } | null
  change: number | null // positive = increased (numeric markers only)
}

export interface PatientSummary {
  patient: {
    id: string
    name: string
    age: number | null
    sex: string | null
    conditions: string | null
    notes: string | null
  }
  latestReportDate: string | null
  previousReportDate: string | null
  totalReports: number
  markers: MarkerSummaryRow[]
  outsideRangeCount: number
  generatedAt: string
}

export async function generatePatientSummary(patientId: string): Promise<PatientSummary> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      reports: {
        orderBy: { reportDate: 'desc' },
        include: {
          markerResults: { orderBy: { markerName: 'asc' } },
        },
      },
    },
  })

  if (!patient) throw new Error('Patient not found')

  const reports = patient.reports
  const latestReport = reports[0] ?? null
  const previousReport = reports[1] ?? null

  // Build a map: markerKey → all results sorted by reportDate desc
  const byKey = new Map<string, { value: number | null; valueText: string | null; date: string; unit: string | null; referenceLow: number | null; referenceHigh: number | null; markerName: string }[]>()

  for (const report of reports) {
    for (const mr of report.markerResults) {
      if (!byKey.has(mr.markerKey)) byKey.set(mr.markerKey, [])
      byKey.get(mr.markerKey)!.push({
        value: mr.value,
        valueText: mr.valueText,
        date: report.reportDate,
        unit: mr.unit,
        referenceLow: mr.referenceLow,
        referenceHigh: mr.referenceHigh,
        markerName: mr.markerName,
      })
    }
  }

  // Enrich category + value type from definitions
  const defs = await prisma.markerDefinition.findMany()
  const defMap = new Map(defs.map((d) => [d.markerKey, d]))

  const markers: MarkerSummaryRow[] = []

  for (const [markerKey, results] of byKey.entries()) {
    const def = defMap.get(markerKey)
    const latest = results[0]
    const previous = results[1] ?? null

    const status = statusForType(def?.valueType, latest.value, latest.referenceLow, latest.referenceHigh)
    const canChange = latest.value != null && previous?.value != null

    markers.push({
      markerKey,
      markerName: latest.markerName,
      category: def?.category ?? 'General',
      valueType: def?.valueType ?? 'numeric',
      unit: latest.unit ?? def?.defaultUnit ?? null,
      latest: {
        value: latest.value,
        valueText: latest.valueText,
        date: latest.date,
        status,
        referenceLow: latest.referenceLow,
        referenceHigh: latest.referenceHigh,
      },
      previous: previous ? { value: previous.value, valueText: previous.valueText, date: previous.date } : null,
      change: canChange ? Math.round((latest.value! - previous!.value!) * 100) / 100 : null,
    })
  }

  // Sort: outside range first, then by category + name
  markers.sort((a, b) => {
    const aOut = a.latest?.status === 'high' || a.latest?.status === 'low' ? 0 : 1
    const bOut = b.latest?.status === 'high' || b.latest?.status === 'low' ? 0 : 1
    if (aOut !== bOut) return aOut - bOut
    return a.category.localeCompare(b.category) || a.markerName.localeCompare(b.markerName)
  })

  const outsideRangeCount = markers.filter(
    (m) => m.latest?.status === 'high' || m.latest?.status === 'low'
  ).length

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      conditions: patient.conditions,
      notes: patient.notes,
    },
    latestReportDate: latestReport?.reportDate ?? null,
    previousReportDate: previousReport?.reportDate ?? null,
    totalReports: reports.length,
    markers,
    outsideRangeCount,
    generatedAt: new Date().toISOString(),
  }
}
