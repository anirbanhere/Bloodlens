'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS, STATUS_CLASSES, type MarkerStatus } from '@/lib/status'
import { ORDINAL_OPTIONS } from '@/lib/qualitative'

type Definition = {
  markerKey: string
  canonicalName: string
  category: string
  defaultUnit: string | null
  valueType: string
}

type MarkerRow = {
  id: string
  markerKey: string
  markerName: string
  value: number | null
  valueText: string | null
  unit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  status: string | null
  notes: string | null
}

const inputCls =
  'border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

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
  const [valueNum, setValueNum] = useState('')
  const [valueText, setValueText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/markers/definitions')
      .then((r) => r.json())
      .then(setDefinitions)
      .catch(() => setError('Could not load marker list'))
  }, [])

  const defByKey = useMemo(
    () => new Map(definitions.map((d) => [d.markerKey, d])),
    [definitions]
  )
  const categories = useMemo(
    () => [...new Set(definitions.map((d) => d.category))],
    [definitions]
  )
  const filtered = useMemo(
    () => (category ? definitions.filter((d) => d.category === category) : definitions),
    [definitions, category]
  )

  const selectedType = defByKey.get(markerKey)?.valueType ?? 'numeric'

  function onMarkerSelect(key: string) {
    setMarkerKey(key)
    const def = defByKey.get(key)
    setUnit(def?.defaultUnit ?? '')
    setValueNum('')
    setValueText('')
  }

  function buildValuePayload(type: string, num: string, text: string) {
    if (type === 'ordinal') {
      const opt = ORDINAL_OPTIONS.find((o) => o.label === text)
      return { value: opt ? opt.ordinal : null, valueText: text || null }
    }
    if (type === 'qualitative') {
      return { value: null, valueText: text || null }
    }
    return { value: num === '' ? null : Number(num), valueText: null }
  }

  async function addMarker(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = buildValuePayload(selectedType, valueNum, valueText)
    const res = await fetch(`/api/reports/${reportId}/markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markerKey,
        unit,
        ...payload,
        referenceLow: fd.get('referenceLow'),
        referenceHigh: fd.get('referenceHigh'),
        notes: fd.get('notes'),
      }),
    })
    setBusy(false)
    if (res.ok) {
      form.reset()
      setMarkerKey('')
      setUnit('')
      setValueNum('')
      setValueText('')
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not save marker')
    }
  }

  async function deleteMarker(id: string) {
    if (!confirm('Delete this marker value?')) return
    await fetch(`/api/reports/${reportId}/markers/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  // Value input that adapts to the marker's value type.
  function ValueField() {
    if (selectedType === 'ordinal') {
      return (
        <label className="text-xs text-slate-500">
          Result *
          <select
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            required
            className={`${inputCls} block w-32 mt-1 bg-white`}
          >
            <option value="">Select…</option>
            {ORDINAL_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>{o.label}</option>
            ))}
          </select>
        </label>
      )
    }
    if (selectedType === 'qualitative') {
      return (
        <label className="text-xs text-slate-500">
          Result *
          <input
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            required
            placeholder="e.g. Straw"
            className={`${inputCls} block w-32 mt-1`}
          />
        </label>
      )
    }
    return (
      <label className="text-xs text-slate-500">
        Value *
        <input
          value={valueNum}
          onChange={(e) => setValueNum(e.target.value)}
          type="number"
          step="any"
          required
          className={`${inputCls} block w-24 mt-1`}
        />
      </label>
    )
  }

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
                      <EditMarkerForm
                        row={m}
                        valueType={defByKey.get(m.markerKey)?.valueType ?? 'numeric'}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSave={async (body) => {
                          setBusy(true)
                          const res = await fetch(`/api/reports/${reportId}/markers/${m.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                          })
                          setBusy(false)
                          if (res.ok) {
                            setEditingId(null)
                            router.refresh()
                          }
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{m.markerName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.valueText ?? m.value}</td>
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
          <ValueField />
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

function EditMarkerForm({
  row,
  valueType,
  busy,
  onSave,
  onCancel,
}: {
  row: MarkerRow
  valueType: string
  busy: boolean
  onSave: (body: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [valueNum, setValueNum] = useState(row.value?.toString() ?? '')
  const [valueText, setValueText] = useState(row.valueText ?? '')
  const [unit, setUnit] = useState(row.unit ?? '')
  const [refLow, setRefLow] = useState(row.referenceLow?.toString() ?? '')
  const [refHigh, setRefHigh] = useState(row.referenceHigh?.toString() ?? '')

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    let value: number | null = null
    let text: string | null = null
    if (valueType === 'ordinal') {
      const opt = ORDINAL_OPTIONS.find((o) => o.label === valueText)
      value = opt ? opt.ordinal : null
      text = valueText || null
    } else if (valueType === 'qualitative') {
      text = valueText || null
    } else {
      value = valueNum === '' ? null : Number(valueNum)
    }
    onSave({ value, valueText: text, unit, referenceLow: refLow, referenceHigh: refHigh })
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <span className="font-medium text-slate-700 mr-1">{row.markerName}</span>
      {valueType === 'ordinal' ? (
        <label className="text-xs text-slate-500">
          Result
          <select value={valueText} onChange={(e) => setValueText(e.target.value)} className={`${inputCls} block w-32 mt-1 bg-white`}>
            <option value="">Select…</option>
            {ORDINAL_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>{o.label}</option>
            ))}
          </select>
        </label>
      ) : valueType === 'qualitative' ? (
        <label className="text-xs text-slate-500">
          Result
          <input value={valueText} onChange={(e) => setValueText(e.target.value)} className={`${inputCls} block w-32 mt-1`} />
        </label>
      ) : (
        <label className="text-xs text-slate-500">
          Value
          <input value={valueNum} onChange={(e) => setValueNum(e.target.value)} type="number" step="any" className={`${inputCls} block w-24 mt-1`} />
        </label>
      )}
      <label className="text-xs text-slate-500">
        Unit
        <input value={unit} onChange={(e) => setUnit(e.target.value)} className={`${inputCls} block w-24 mt-1`} />
      </label>
      <label className="text-xs text-slate-500">
        Ref low
        <input value={refLow} onChange={(e) => setRefLow(e.target.value)} type="number" step="any" className={`${inputCls} block w-20 mt-1`} />
      </label>
      <label className="text-xs text-slate-500">
        Ref high
        <input value={refHigh} onChange={(e) => setRefHigh(e.target.value)} type="number" step="any" className={`${inputCls} block w-20 mt-1`} />
      </label>
      <button type="submit" disabled={busy} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-slate-500 px-2 py-1.5 text-sm hover:text-slate-700">
        Cancel
      </button>
    </form>
  )
}
