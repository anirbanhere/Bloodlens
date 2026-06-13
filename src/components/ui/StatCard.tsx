import clsx from 'clsx'
import Card from './Card'

type Tone = 'brand' | 'ok' | 'alert' | 'warn' | 'neutral'

const TONE: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  ok: 'bg-ok-50 text-ok-600',
  alert: 'bg-alert-50 text-alert-600',
  warn: 'bg-warn-50 text-warn-600',
  neutral: 'bg-slate-100 text-slate-500',
}

export default function StatCard({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  tone?: Tone
  hint?: string
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      {icon && (
        <span className={clsx('inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0', TONE[tone])}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="text-xl font-semibold text-slate-800 tabular-nums leading-tight">{value}</p>
        {hint && <p className="text-xs text-slate-400 truncate">{hint}</p>}
      </div>
    </Card>
  )
}
