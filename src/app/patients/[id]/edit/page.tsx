import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import PatientForm from '@/components/PatientForm'
import PageHeader from '@/components/ui/PageHeader'

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
      <PageHeader title={`Edit ${patient.name}`} />
      <PatientForm patient={patient} />
    </div>
  )
}
