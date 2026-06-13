import clsx from 'clsx'
import { STATUS_CLASSES, STATUS_LABELS, type MarkerStatus } from '@/lib/status'
import StatusDot from './StatusDot'

/** Status pill — shows a colored dot + the calm status label. */
export function StatusBadge({ status }: { status: MarkerStatus | string | null }) {
  const key = (status ?? 'unknown') as MarkerStatus
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        STATUS_CLASSES[key] ?? STATUS_CLASSES.unknown
      )}
    >
      <StatusDot status={key} />
      {STATUS_LABELS[key] ?? STATUS_LABELS.unknown}
    </span>
  )
}

/** Neutral count/meta pill. */
export default function Badge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600',
        className
      )}
    >
      {children}
    </span>
  )
}
