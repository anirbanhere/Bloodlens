import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ReportForm from '@/components/ReportForm'
import PageHeader from '@/components/ui/PageHeader'

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
        <PageHeader title="New report" subtitle="Choose a patient" />
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card divide-y divide-slate-100 max-w-lg overflow-hidden">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/reports/new?patientId=${p.id}`}
              className="block px-5 py-4 hover:bg-slate-50 font-medium text-slate-700 transition"
            >
              {p.name}
            </Link>
          ))}
          {patients.length === 0 && (
            <p className="px-5 py-4 text-slate-500">
              No patients yet. <Link className="text-brand-600 hover:underline" href="/patients/new">Add one first.</Link>
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
      <PageHeader title="New report" subtitle={`for ${patient.name}`} />
      <ReportForm patientId={patient.id} />
    </div>
  )
}
