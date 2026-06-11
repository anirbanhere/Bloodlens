'use client'

import { useRouter } from 'next/navigation'

export default function DeleteReportButton({
  reportId,
  patientId,
}: {
  reportId: string
  patientId: string
}) {
  const router = useRouter()

  async function onDelete() {
    if (!confirm('Delete this report and all its marker values? This cannot be undone.')) return
    const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(`/patients/${patientId}`)
      router.refresh()
    }
  }

  return (
    <button
      onClick={onDelete}
      className="text-sm text-slate-500 border border-slate-300 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200"
    >
      Delete report
    </button>
  )
}
