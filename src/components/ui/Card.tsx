import clsx from 'clsx'

export default function Card({
  hover = false,
  className,
  children,
  ...rest
}: {
  hover?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'bg-surface rounded-card border border-slate-200/80 shadow-card',
        hover && 'transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
