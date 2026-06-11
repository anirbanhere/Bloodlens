import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      reports: {
        orderBy: { reportDate: 'desc' },
        include: { _count: { select: { markerResults: true, reportFiles: true } } },
      },
    },
  })
  if (!patient) notFound()

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{patient.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {[patient.age ? `${patient.age} yrs` : null, patient.sex, patient.conditions]
              .filter(Boolean)
              .join(' · ') || 'No details yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/patients/${patient.id}/edit`}
            className="text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Edit profile
          </Link>
          <Link
            href={`/patients/${patient.id}/table`}
            className="text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Marker table
          </Link>
          <Link
            href={`/reports/new?patientId=${patient.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add report
          </Link>
        </div>
      </div>

      <h2 className="font-semibold text-slate-700 mb-3">Reports</h2>
      {patient.reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No reports yet. Add the first one to start tracking.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {patient.reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-800">{r.reportDate}</p>
                <p className="text-sm text-slate-500">
                  {[r.labName, r.reportType].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-1 rounded-full">
                  {r._count.markerResults} marker{r._count.markerResults === 1 ? '' : 's'}
                </span>
                {r._count.reportFiles > 0 && (
                  <span className="bg-slate-100 px-2 py-1 rounded-full">
                    {r._count.reportFiles} file{r._count.reportFiles === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
