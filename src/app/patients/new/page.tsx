import PatientForm from '@/components/PatientForm'
import PageHeader from '@/components/ui/PageHeader'

export default function NewPatientPage() {
  return (
    <div>
      <PageHeader title="Add patient" />
      <PatientForm />
    </div>
  )
}
