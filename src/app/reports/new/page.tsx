import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ReportForm from '@/components/ReportForm'

export const dynamic = 'force-dynamic'

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>
}) {
  const { patientId } = await searchParams

  if (!patientId) {
    const patients = await prisma.patient.findMany({ orderBy: { createdAt: 'asc' } })
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">New report — choose patient</h1>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-w-lg">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/reports/new?patientId=${p.id}`}
              className="block px-5 py-4 hover:bg-slate-50 font-medium text-slate-700"
            >
              {p.name}
            </Link>
          ))}
          {patients.length === 0 && (
            <p className="px-5 py-4 text-slate-500">
              No patients yet. <Link className="text-blue-600 hover:underline" href="/patients/new">Add one first.</Link>
            </p>
          )}
        </div>
      </div>
    )
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">New report</h1>
      <p className="text-sm text-slate-500 mb-6">for {patient.name}</p>
      <ReportForm patientId={patient.id} />
    </div>
  )
}
