import Link from 'next/link'
import { notFound } from 'next/navigation'
import { generatePatientSummary } from '@/lib/summaryGenerator'
import PrintButton from '@/components/PrintButton'

export const dynamic = 'force-dynamic'

const STATUS_DOT: Record<string, string> = {
  high: 'bg-red-500',
  low: 'bg-amber-500',
  normal: 'bg-green-500',
  unknown: 'bg-slate-300',
}

const STATUS_LABEL: Record<string, string> = {
  high: 'Above range',
  low: 'Below range',
  normal: 'In range',
  unknown: '—',
}

function ChangeArrow({ change }: { change: number | null }) {
  if (change === null) return null
  if (Math.abs(change) < 0.001) return <span className="text-slate-400 text-xs">no change</span>
  const up = change > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-red-600' : 'text-green-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(change)}
    </span>
  )
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let summary
  try {
    summary = await generatePatientSummary(id)
  } catch {
    notFound()
  }

  const { patient, markers, outsideRangeCount, latestReportDate, previousReportDate, totalReports } = summary

  // Group markers by category
  const byCategory = new Map<string, typeof markers>()
  for (const m of markers) {
    if (!byCategory.has(m.category)) byCategory.set(m.category, [])
    byCategory.get(m.category)!.push(m)
  }

  return (
    <div>
      {/* Print styles — hide nav, show all content */}
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { font-size: 12px; }
          .print-page-break { page-break-before: always; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 no-print">
        <div>
          <p className="text-sm text-slate-500">
            <Link href={`/patients/${patient.id}`} className="text-blue-600 hover:underline">{patient.name}</Link>
          </p>
          <h1 className="text-2xl font-bold text-slate-800">Pre-appointment summary</h1>
          <p className="text-sm text-slate-500 mt-1">Generated {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 no-print">
          <PrintButton />
          <Link
            href={`/patients/${patient.id}`}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Back to patient
          </Link>
        </div>
      </div>

      {/* Print header (visible in print only) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">BloodLens — Pre-appointment summary</h1>
        <p className="text-sm text-slate-600 mt-1">Patient: {patient.name} · Generated {new Date().toLocaleDateString()}</p>
      </div>

      {/* Patient overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <h2 className="font-medium text-slate-700 mb-3">Patient overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {patient.age && <div><span className="text-slate-500">Age</span><p className="font-medium">{patient.age}</p></div>}
          {patient.sex && <div><span className="text-slate-500">Sex</span><p className="font-medium">{patient.sex}</p></div>}
          <div><span className="text-slate-500">Reports on file</span><p className="font-medium">{totalReports}</p></div>
          <div><span className="text-slate-500">Latest report</span><p className="font-medium">{latestReportDate ?? '—'}</p></div>
          {patient.conditions && (
            <div className="col-span-2 sm:col-span-4">
              <span className="text-slate-500">Conditions</span>
              <p className="font-medium">{patient.conditions}</p>
            </div>
          )}
          {patient.notes && (
            <div className="col-span-2 sm:col-span-4">
              <span className="text-slate-500">Notes</span>
              <p className="font-medium">{patient.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* At-a-glance banner */}
      {outsideRangeCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800">
          {outsideRangeCount} marker{outsideRangeCount !== 1 ? 's' : ''} outside reference range
          {previousReportDate && ` — compared with ${previousReportDate}`}
        </div>
      )}

      {/* Marker table by category */}
      {[...byCategory.entries()].map(([category, rows]) => (
        <div key={category} className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-medium text-slate-700">{category}</h2>
            <span className="text-xs text-slate-400">{rows.length} marker{rows.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-left px-5 py-2 font-medium">Marker</th>
                <th className="text-left px-3 py-2 font-medium">Latest</th>
                <th className="text-left px-3 py-2 font-medium">Previous</th>
                <th className="text-left px-3 py-2 font-medium">Change</th>
                <th className="text-left px-3 py-2 font-medium">Ref range</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((m) => {
                const st = m.latest?.status ?? 'unknown'
                return (
                  <tr key={m.markerKey} className={st === 'high' || st === 'low' ? 'bg-red-50/40' : ''}>
                    <td className="px-5 py-2.5 font-medium text-slate-700">
                      <Link href={`/patients/${patient.id}/markers/${m.markerKey}`} className="hover:text-blue-600 no-print">
                        {m.markerName}
                      </Link>
                      <span className="hidden print:inline">{m.markerName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">
                      {m.latest ? `${m.latest.value} ${m.unit ?? ''}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {m.previous ? `${m.previous.value} ${m.unit ?? ''}` : '—'}
                    </td>
                    <td className="px-3 py-2.5"><ChangeArrow change={m.change} /></td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">
                      {m.latest?.referenceLow != null && m.latest?.referenceHigh != null
                        ? `${m.latest.referenceLow} – ${m.latest.referenceHigh}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[st]}`} />
                        <span className="text-xs text-slate-600">{STATUS_LABEL[st]}</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {markers.length === 0 && (
        <p className="text-sm text-slate-400 mt-4">No marker data recorded yet.</p>
      )}

      {/* Medical disclaimer */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400">
        <p>
          This summary contains factual lab data recorded by the user and is intended to support
          appointments with qualified healthcare providers. It does not constitute medical advice,
          diagnosis, or treatment. Always consult your doctor before making any health decisions.
        </p>
      </div>
    </div>
  )
}
