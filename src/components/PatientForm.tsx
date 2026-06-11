'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          name="name"
          required
          defaultValue={patient?.name ?? ''}
          placeholder="e.g. Mother"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
          <input
            name="age"
            type="number"
            min={0}
            max={120}
            defaultValue={patient?.age ?? ''}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sex</label>
          <select
            name="sex"
            defaultValue={patient?.sex ?? ''}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Conditions</label>
        <input
          name="conditions"
          defaultValue={patient?.conditions ?? ''}
          placeholder="e.g. CKD, diabetes, hypertension"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={patient?.notes ?? ''}
          placeholder="Any important medical context"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : patient?.id ? 'Save changes' : 'Add patient'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
