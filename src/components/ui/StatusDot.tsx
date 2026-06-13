import clsx from 'clsx'
import type { MarkerStatus } from '@/lib/status'

const DOT: Record<string, string> = {
  high: 'bg-alert-500',
  low: 'bg-warn-500',
  normal: 'bg-ok-500',
  unknown: 'bg-slate-300',
}

export default function StatusDot({
  status,
  className,
}: {
  status: MarkerStatus | string | null
  className?: string
}) {
  const color = DOT[status ?? 'unknown'] ?? 'bg-slate-300'
  return <span className={clsx('inline-block w-2 h-2 rounded-full shrink-0', color, className)} aria-hidden />
}
