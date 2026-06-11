import PatientForm from '@/components/PatientForm'

export default function NewPatientPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Add patient</h1>
      <PatientForm />
    </div>
  )
}
