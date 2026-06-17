'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

type Candidate = {
  id: string
  markerName: string
  suggestedValue: number | null
  suggestedValueText: string | null
  suggestedUnit: string | null
  suggestedReferenceLow: number | null
  suggestedReferenceHigh: number | null
  confidence: string
  sourceText: string | null
  status: string
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-ok-50 text-ok-700',
  medium: 'bg-warn-50 text-warn-700',
  low: 'bg-alert-50 text-alert-700',
}

export default function ExtractionReviewTable({
  extractionId,
  reportId,
  initialCandidates,
}: {
  extractionId: string
  reportId: string
  initialCandidates: Candidate[]
}) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [error, setError] = useState('')

  const accepted = candidates.filter((c) => c.status === 'accepted')

  async function patchCandidate(id: string, updates: Partial<Candidate>) {
    const res = await fetch(`/api/extractions/${extractionId}/candidates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: id, ...updates }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)))
    }
  }

  function toggleStatus(c: Candidate) {
    const next = c.status === 'accepted' ? 'pending' : 'accepted'
    patchCandidate(c.id, { status: next })
  }

  function ignoreCandidate(c: Candidate) {
    patchCandidate(c.id, { status: 'ignored' })
  }

  async function confirmAll() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/extractions/${extractionId}/confirm`, { method: 'POST' })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setResult(data)
      setConfirmed(true)
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to save markers')
    }
  }

  if (confirmed && result) {
    return (
      <div className="bg-ok-50 border border-ok-100 rounded-card p-6 text-center">
        <p className="text-ok-700 font-medium text-lg mb-1">
          {result.saved} marker{result.saved !== 1 ? 's' : ''} saved
        </p>
        {result.skipped > 0 && (
          <p className="text-ok-600 text-sm mb-3">{result.skipped} skipped (no value)</p>
        )}
        <button
          onClick={() => router.push(`/reports/${reportId}`)}
          className="text-sm text-brand-600 hover:underline"
        >
          View report →
        </button>
      </div>
    )
  }

  const visible = candidates.filter((c) => c.status !== 'ignored')
  const ignored = candidates.filter((c) => c.status === 'ignored')

  // Build the row list with a divider inserted whenever the confidence tier changes.
  type DividerRow = { type: 'divider'; tier: string }
  type CandRow = { type: 'candidate'; c: Candidate }
  const rows: Array<DividerRow | CandRow> = []
  let lastTier = ''
  for (const c of visible) {
    if (c.confidence !== lastTier) {
      rows.push({ type: 'divider', tier: c.confidence })
      lastTier = c.confidence
    }
    rows.push({ type: 'candidate', c })
  }

  const TIER_LABEL: Record<string, string> = {
    low:    'Low confidence — verify these carefully before accepting',
    medium: 'Medium confidence',
    high:   'High confidence',
  }
  const TIER_STYLE: Record<string, string> = {
    low:    'bg-alert-50 text-alert-700 border-alert-100',
    medium: 'bg-warn-50  text-warn-700  border-warn-100',
    high:   'bg-ok-50    text-ok-700    border-ok-100',
  }

  return (
    <div>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">No marker candidates found in this file.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-3 font-medium w-6"></th>
                  <th className="pb-2 pr-3 font-medium">Marker</th>
                  <th className="pb-2 pr-3 font-medium">Value</th>
                  <th className="pb-2 pr-3 font-medium">Unit</th>
                  <th className="pb-2 pr-3 font-medium">Ref range</th>
                  <th className="pb-2 pr-3 font-medium">Confidence</th>
                  <th className="pb-2 pr-3 font-medium">Source snippet</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => {
                  if (row.type === 'divider') {
                    return (
                      <tr key={`div-${row.tier}-${i}`}>
                        <td colSpan={8} className={`px-3 py-1.5 text-xs font-semibold border-y ${TIER_STYLE[row.tier]}`}>
                          {TIER_LABEL[row.tier]}
                        </td>
                      </tr>
                    )
                  }
                  const c = row.c
                  return (
                    <tr key={c.id} className={c.status === 'accepted' ? 'bg-ok-50' : ''}>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={c.status === 'accepted'}
                          onChange={() => toggleStatus(c)}
                          className="rounded accent-brand-500"
                        />
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-700">{c.markerName}</td>

                      {editingId === c.id ? (
                        <EditRow
                          candidate={c}
                          onSave={(updates) => {
                            patchCandidate(c.id, updates)
                            setEditingId(null)
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <>
                          <td className="py-2 pr-3 text-slate-800">
                            {c.suggestedValueText ?? c.suggestedValue ?? <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">
                            {c.suggestedUnit ?? <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-slate-500 text-xs">
                            {c.suggestedReferenceLow != null && c.suggestedReferenceHigh != null
                              ? `${c.suggestedReferenceLow} – ${c.suggestedReferenceHigh}`
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${CONFIDENCE_BADGE[c.confidence] ?? ''}`}>
                              {c.confidence}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-xs text-slate-400 max-w-[220px] truncate" title={c.sourceText ?? ''}>
                            {c.sourceText ?? '—'}
                          </td>
                          <td className="py-2">
                            <span className="flex gap-3 whitespace-nowrap">
                              <button onClick={() => setEditingId(c.id)} className="text-xs text-brand-600 hover:underline">Edit</button>
                              <button onClick={() => ignoreCandidate(c)} className="text-xs text-slate-400 hover:text-alert-600">Ignore</button>
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {ignored.length > 0 && (
            <p className="text-xs text-slate-400 mt-2">{ignored.length} row{ignored.length !== 1 ? 's' : ''} ignored</p>
          )}

          {error && <p className="text-sm text-alert-600 mt-3">{error}</p>}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              {accepted.length} marker{accepted.length !== 1 ? 's' : ''} selected
            </p>
            <Button onClick={confirmAll} disabled={saving || accepted.length === 0}>
              {saving ? 'Saving…' : `Save ${accepted.length} marker${accepted.length !== 1 ? 's' : ''} to report`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function EditRow({
  candidate,
  onSave,
  onCancel,
}: {
  candidate: Candidate
  onSave: (updates: Partial<Candidate>) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(candidate.suggestedValue?.toString() ?? '')
  const [valueText, setValueText] = useState(candidate.suggestedValueText ?? '')
  const [unit, setUnit] = useState(candidate.suggestedUnit ?? '')
  const [refLow, setRefLow] = useState(candidate.suggestedReferenceLow?.toString() ?? '')
  const [refHigh, setRefHigh] = useState(candidate.suggestedReferenceHigh?.toString() ?? '')

  function save() {
    onSave({
      suggestedValue: value ? parseFloat(value) : null,
      suggestedValueText: valueText.trim() || null,
      suggestedUnit: unit || null,
      suggestedReferenceLow: refLow ? parseFloat(refLow) : null,
      suggestedReferenceHigh: refHigh ? parseFloat(refHigh) : null,
    })
  }

  const inp = 'border border-slate-300 rounded px-1.5 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-brand-400'

  return (
    <>
      <td className="py-1 pr-2">
        <input className={inp} value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" />
        <input className={`${inp} mt-1`} value={valueText} onChange={(e) => setValueText(e.target.value)} placeholder="label (e.g. 3+)" />
      </td>
      <td className="py-1 pr-2"><input className={inp} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" /></td>
      <td className="py-1 pr-2">
        <span className="flex gap-1 items-center">
          <input className={inp} value={refLow} onChange={(e) => setRefLow(e.target.value)} placeholder="low" />
          <span className="text-slate-400 text-xs">–</span>
          <input className={inp} value={refHigh} onChange={(e) => setRefHigh(e.target.value)} placeholder="high" />
        </span>
      </td>
      <td colSpan={3} className="py-1">
        <span className="flex gap-2">
          <button onClick={save} className="text-xs text-brand-600 hover:underline">Save</button>
          <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </span>
      </td>
    </>
  )
}
