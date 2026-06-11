import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function PatientsPage() {
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { reports: true } },
      reports: { orderBy: { reportDate: 'desc' }, take: 1 },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Patients</h1>
        <Link
          href="/patients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Add patient
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-slate-500 mb-4">No patients yet.</p>
          <Link
            href="/patients/new"
            className="text-blue-600 font-medium hover:underline"
          >
            Add your first family member
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-lg text-slate-800">{p.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[p.age ? `${p.age} yrs` : null, p.sex].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {p._count.reports} report{p._count.reports === 1 ? '' : 's'}
                </span>
              </div>
              {p.conditions && (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="text-slate-400">Conditions: </span>
                  {p.conditions}
                </p>
              )}
              {p.reports[0] && (
                <p className="mt-2 text-xs text-slate-400">
                  Latest report: {p.reports[0].reportDate}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
