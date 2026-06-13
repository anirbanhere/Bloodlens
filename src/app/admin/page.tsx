import { Download } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

export default function AdminPage() {
  return (
    <div>
      <PageHeader title="Admin" />

      <Card className="p-5 mb-5">
        <h2 className="font-medium text-slate-700 mb-1">Backup</h2>
        <p className="text-sm text-slate-500 mb-4">
          Downloads a ZIP containing the database and all uploaded report files.
          Store it somewhere safe — this is your only copy of the data.
        </p>
        <Button href="/api/admin/backup" icon={<Download size={16} />} download>
          Download backup ZIP
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="font-medium text-slate-700 mb-1">Restore</h2>
        <p className="text-sm text-slate-500 mb-2">To restore from a backup:</p>
        <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
          <li>Stop the Railway service</li>
          <li>Extract the ZIP — it contains <code className="bg-slate-100 px-1 rounded">backup/health.db</code> and <code className="bg-slate-100 px-1 rounded">backup/uploads/</code></li>
          <li>Use Railway&apos;s volume file browser (or SSH) to replace <code className="bg-slate-100 px-1 rounded">/data/health.db</code> and restore <code className="bg-slate-100 px-1 rounded">/data/uploads/</code></li>
          <li>Restart the service</li>
        </ol>
      </Card>
    </div>
  )
}
