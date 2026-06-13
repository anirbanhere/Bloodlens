'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const EXTRACTABLE = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp'])

type ReportFileRow = {
  id: string
  fileType: string
  originalFilename: string
  displayName: string | null
}

export default function FileSection({
  reportId,
  files,
}: {
  reportId: string
  files: ReportFileRow[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(files[0]?.id ?? null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [passwordFileId, setPasswordFileId] = useState<string | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/reports/${reportId}/files`, { method: 'POST', body: fd })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (res.ok) {
      const created = await res.json()
      setPreviewId(created.id)
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Upload failed')
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this file? The original upload will be removed from storage.')) return
    await fetch(`/api/files/${id}`, { method: 'DELETE' })
    if (previewId === id) setPreviewId(null)
    router.refresh()
  }

  async function onExtract(id: string, password?: string) {
    setExtracting(id)
    setError('')
    setPasswordError('')
    const res = await fetch(`/api/files/${id}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setExtracting(null)
    if (res.ok) {
      const data = await res.json()
      setPasswordFileId(null)
      setPasswordInput('')
      router.push(`/extractions/${data.extractionId}/review`)
    } else {
      const body = await res.json().catch(() => ({}))
      if (body.passwordRequired) {
        setPasswordFileId(id)
        if (body.wrongPassword) setPasswordError('Incorrect password — try again.')
      } else {
        setError(body.error ?? 'Extraction failed')
      }
    }
  }

  async function onExtractWithPassword(e: React.FormEvent, id: string) {
    e.preventDefault()
    await onExtract(id, passwordInput)
  }

  async function onRename(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault()
    const displayName = new FormData(e.currentTarget).get('displayName')
    await fetch(`/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })
    setRenamingId(null)
    router.refresh()
  }

  const preview = files.find((f) => f.id === previewId)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-slate-700">Original report files</h3>
        <label className={`text-sm px-3 py-1.5 rounded-lg cursor-pointer font-medium ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {uploading ? 'Uploading…' : '+ Upload file'}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={onUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {files.length === 0 ? (
        <p className="text-sm text-slate-400">
          No files attached. Upload the original PDF, screenshot, or photo of this report.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 mb-4">
            {files.map((f) => (
              <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                {renamingId === f.id ? (
                  <form onSubmit={(e) => onRename(e, f.id)} className="flex items-center gap-2 flex-1">
                    <input
                      name="displayName"
                      defaultValue={f.displayName ?? f.originalFilename}
                      autoFocus
                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" className="text-xs text-blue-600 hover:underline">Save</button>
                    <button type="button" onClick={() => setRenamingId(null)} className="text-xs text-slate-400">Cancel</button>
                  </form>
                ) : (
                  <>
                    <button
                      onClick={() => setPreviewId(f.id)}
                      className={`text-sm text-left flex-1 truncate hover:text-blue-600 ${previewId === f.id ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                    >
                      <span className="uppercase text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 mr-2">{f.fileType}</span>
                      {f.displayName ?? f.originalFilename}
                    </button>
                    <span className="flex gap-3 text-xs whitespace-nowrap items-center">
                      <a href={`/api/files/${f.id}/view`} target="_blank" className="text-blue-600 hover:underline">
                        Open
                      </a>
                      {EXTRACTABLE.has(f.fileType) && (
                        passwordFileId === f.id ? (
                          <form onSubmit={(e) => onExtractWithPassword(e, f.id)} className="flex items-center gap-1.5">
                            <input
                              type="password"
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              placeholder="PDF password"
                              autoFocus
                              className="border border-slate-300 rounded px-2 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                              type="submit"
                              disabled={extracting === f.id || !passwordInput}
                              className="text-purple-600 hover:underline disabled:text-slate-400"
                            >
                              {extracting === f.id ? 'Extracting…' : 'Unlock & extract'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPasswordFileId(null); setPasswordInput(''); setPasswordError('') }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                            {passwordError && <span className="text-red-500">{passwordError}</span>}
                          </form>
                        ) : (
                          <button
                            onClick={() => onExtract(f.id)}
                            disabled={extracting === f.id}
                            className="text-purple-600 hover:underline disabled:text-slate-400"
                          >
                            {extracting === f.id ? 'Extracting…' : 'Extract markers'}
                          </button>
                        )
                      )}
                      <button onClick={() => setRenamingId(f.id)} className="text-slate-400 hover:text-slate-600">
                        Rename
                      </button>
                      <button onClick={() => onDelete(f.id)} className="text-slate-400 hover:text-red-600">
                        Delete
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>

          {preview && (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              {preview.fileType === 'pdf' ? (
                <iframe
                  src={`/api/files/${preview.id}/view`}
                  title={preview.displayName ?? preview.originalFilename}
                  className="w-full h-[600px]"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${preview.id}/view`}
                  alt={preview.displayName ?? preview.originalFilename}
                  className="max-h-[600px] mx-auto"
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
