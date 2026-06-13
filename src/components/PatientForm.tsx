'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

type PatientInput = {
  id?: string
  name?: string
  age?: number | null
  sex?: string | null
  conditions?: string | null
  notes?: string | null
}

export default function PatientForm({ patient }: { patient?: PatientInput }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const isEdit = Boolean(patient?.id)
    const res = await fetch(isEdit ? `/api/patients/${patient!.id}` : '/api/patients', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const saved = await res.json()
      router.push(`/patients/${saved.id ?? patient!.id}`)
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface rounded-card border border-slate-200/80 shadow-card p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input name="name" required defaultValue={patient?.name ?? ''} placeholder="e.g. Mother" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
          <input name="age" type="number" min={0} max={120} defaultValue={patient?.age ?? ''} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sex</label>
          <select name="sex" defaultValue={patient?.sex ?? ''} className="input">
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Conditions</label>
        <input name="conditions" defaultValue={patient?.conditions ?? ''} placeholder="e.g. CKD, diabetes, hypertension" className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea name="notes" rows={3} defaultValue={patient?.notes ?? ''} placeholder="Any important medical context" className="input" />
      </div>
      {error && <p className="text-sm text-alert-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : patient?.id ? 'Save changes' : 'Add patient'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
