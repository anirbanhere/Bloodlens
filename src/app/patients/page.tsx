import Link from 'next/link'
import { prisma } from '@/lib/db'
import { UserPlus, Users, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function PatientsPage() {
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { reports: true } },
      reports: { orderBy: { reportDate: 'desc' }, take: 1 },
    },
  })

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={patients.length > 0 ? `${patients.length} family member${patients.length === 1 ? '' : 's'} tracked` : undefined}
        actions={
          <Button href="/patients/new" icon={<UserPlus size={16} />}>
            Add patient
          </Button>
        }
      />

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No patients yet"
          message="Add your first family member to start tracking lab reports and trends."
          action={
            <Button href="/patients/new" icon={<UserPlus size={16} />}>
              Add your first family member
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {patients.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`} className="group">
              <Card hover className="p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-brand-100 text-brand-700 font-semibold shrink-0">
                    {initials(p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-lg text-slate-800 truncate">{p.name}</h2>
                      <Badge>{p._count.reports} report{p._count.reports === 1 ? '' : 's'}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {[p.age ? `${p.age} yrs` : null, p.sex].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {p.conditions && (
                      <p className="mt-2 text-sm text-slate-600 truncate">
                        <span className="text-slate-400">Conditions: </span>
                        {p.conditions}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                      {p.reports[0]
                        ? `Latest report: ${p.reports[0].reportDate || 'date not set'}`
                        : 'No reports yet'}
                      <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-brand-400 transition" />
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
