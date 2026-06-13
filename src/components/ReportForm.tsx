'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function ReportForm({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, patientId }),
    })
    if (res.ok) {
      const report = await res.json()
      router.push(`/reports/${report.id}`)
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Report date</label>
        <input name="reportDate" type="date" className="input" />
        <p className="text-xs text-slate-400 mt-1">
          Optional — leave blank to auto-fill from the report when you upload and extract a PDF.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Lab name</label>
        <input name="labName" placeholder="e.g. Apollo Diagnostics" className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Report type</label>
        <select name="reportType" defaultValue="" className="input">
          <option value="">—</option>
          <option value="blood test">Blood test</option>
          <option value="urine test">Urine test</option>
          <option value="full health package">Full health package</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea name="notes" rows={2} placeholder="e.g. Before doctor visit" className="input" />
      </div>
      {error && <p className="text-sm text-alert-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create report'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
