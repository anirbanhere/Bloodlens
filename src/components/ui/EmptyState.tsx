import Card from './Card'

export default function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode
  title?: string
  message: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card className="p-10 text-center">
      {icon && (
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 text-brand-500 mb-4">
          {icon}
        </span>
      )}
      {title && <p className="font-medium text-slate-700 mb-1">{title}</p>}
      <p className="text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  )
}
