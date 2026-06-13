'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'

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
    <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={onDelete}>
      Delete report
    </Button>
  )
}
