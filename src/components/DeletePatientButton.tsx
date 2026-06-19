'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function DeletePatientButton({
  patientId,
  patientName,
  reportCount,
}: {
  patientId: string
  patientName: string
  reportCount: number
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function onDelete() {
    const reports = reportCount > 0 ? ` and all ${reportCount} report${reportCount === 1 ? '' : 's'}` : ''
    if (!confirm(`Delete ${patientName}${reports}, including every marker value and uploaded file? This cannot be undone.`)) {
      return
    }
    setDeleting(true)
    const res = await fetch(`/api/patients/${patientId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/patients')
      router.refresh()
    } else {
      setDeleting(false)
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Failed to delete patient')
    }
  }

  return (
    <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={onDelete} disabled={deleting}>
      {deleting ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
