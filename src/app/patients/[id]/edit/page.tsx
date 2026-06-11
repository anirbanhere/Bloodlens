import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import PatientForm from '@/components/PatientForm'

export const dynamic = 'force-dynamic'

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = await prisma.patient.findUnique({ where: { id } })
  if (!patient) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Edit {patient.name}</h1>
      <PatientForm patient={patient} />
    </div>
  )
}
