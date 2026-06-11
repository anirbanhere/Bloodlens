'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS, STATUS_CLASSES, type MarkerStatus } from '@/lib/status'

type Definition = {
  markerKey: string
  canonicalName: string
  category: string
  defaultUnit: string | null
}

type MarkerRow = {
  id: string
  markerKey: string
  markerName: string
  value: number
  unit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  status: string | null
  notes: string | null
}

export default function MarkerEntry({
  reportId,
  markers,
}: {
  reportId: string
  markers: MarkerRow[]
}) {
  const router = useRouter()
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [category, setCategory] = useState('')
  const [markerKey, setMarkerKey] = useState('')
  const [unit, setUnit] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/markers/definitions')
      .then((r) => r.json())
      .then(setDefinitions)
      .catch(() => setError('Could not load marker list'))
  }, [])

  const categories = useMemo(
    () => [...new Set(definitions.map((d) => d.category))],
    [definitions]
  )
  const filtered = useMemo(
    () => (category ? definitions.filter((d) => d.category === category) : definitions),
    [definitions, category]
  )

  function onMarkerSelect(key: string) {
    setMarkerKey(key)
    const def = definitions.find((d) => d.markerKey === key)
    setUnit(def?.defaultUnit ?? '')
  }

  async function addMarker(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const res = await fetch(`/api/reports/${reportId}/markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, markerKey, unit }),
    })
    setBusy(false)
    if (res.ok) {
      form.reset()
      setMarkerKey('')
      setUnit('')
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not save marker')
    }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>, row: MarkerRow) {
    e.preventDefault()
    setBusy(true)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const res = await fetch(`/api/reports/${reportId}/markers/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setBusy(false)
    if (res.ok) {
      setEditingId(null)
      router.refresh()
    }
  }

  async function deleteMarker(id: string) {
    if (!confirm('Delete this marker value?')) return
    await fetch(`/api/reports/${reportId}/markers/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const inputCls =
    'border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Existing markers */}
      {markers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="px-4 py-2.5 font-medium">Marker</th>
                <th className="px-4 py-2.5 font-medium text-right">Value</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {markers.map((m) =>
                editingId === m.id ? (
                  <tr key={m.id} className="bg-blue-50/40">
                    <td colSpan={6} className="px-4 py-3">
                      <form onSubmit={(e) => saveEdit(e, m)} className="flex flex-wrap items-end gap-3">
                        <span className="font-medium text-slate-700 mr-1">{m.markerName}</span>
                        <label className="text-xs text-slate-500">
                          Value
                          <input name="value" type="number" step="any" required defaultValue={m.value} className={`${inputCls} block w-24 mt-1`} />
                        </label>
                        <label className="text-xs text-slate-500">
                          Unit
                          <input name="unit" defaultValue={m.unit ?? ''} className={`${inputCls} block w-24 mt-1`} />
                        </label>
                        <label className="text-xs text-slate-500">
                          Ref low
                          <input name="referenceLow" type="number" step="any" defaultValue={m.referenceLow ?? ''} className={`${inputCls} block w-20 mt-1`} />
                        </label>
                        <label className="text-xs text-slate-500">
                          Ref high
                          <input name="referenceHigh" type="number" step="any" defaultValue={m.referenceHigh ?? ''} className={`${inputCls} block w-20 mt-1`} />
                        </label>
                        <button type="submit" disabled={busy} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-slate-500 px-2 py-1.5 text-sm hover:text-slate-700">
                          Cancel
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{m.markerName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.value}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.unit ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {m.referenceLow != null || m.referenceHigh != null
                        ? `${m.referenceLow ?? '·'} – ${m.referenceHigh ?? '·'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${STATUS_CLASSES[(m.status as MarkerStatus) ?? 'unknown']}`}>
                        {STATUS_LABELS[(m.status as MarkerStatus) ?? 'unknown']}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setEditingId(m.id)} className="text-xs text-blue-600 hover:underline mr-3">
                        Edit
                      </button>
                      <button onClick={() => deleteMarker(m.id)} className="text-xs text-slate-400 hover:text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add marker form */}
      <form onSubmit={addMarker} className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-700 mb-4">Add marker value</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            Category
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setMarkerKey(''); setUnit('') }}
              className={`${inputCls} block w-44 mt-1 bg-white`}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Marker *
            <select
              value={markerKey}
              onChange={(e) => onMarkerSelect(e.target.value)}
              required
              className={`${inputCls} block w-52 mt-1 bg-white`}
            >
              <option value="">Select marker…</option>
              {filtered.map((d) => (
                <option key={d.markerKey} value={d.markerKey}>{d.canonicalName}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Value *
            <input name="value" type="number" step="any" required className={`${inputCls} block w-24 mt-1`} />
          </label>
          <label className="text-xs text-slate-500">
            Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={`${inputCls} block w-28 mt-1`}
            />
          </label>
          <label className="text-xs text-slate-500">
            Ref low
            <input name="referenceLow" type="number" step="any" className={`${inputCls} block w-20 mt-1`} />
          </label>
          <label className="text-xs text-slate-500">
            Ref high
            <input name="referenceHigh" type="number" step="any" className={`${inputCls} block w-20 mt-1`} />
          </label>
          <button
            type="submit"
            disabled={busy || !markerKey}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </div>
  )
}
