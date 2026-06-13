import Link from 'next/link'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 border border-transparent',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
  danger: 'bg-white text-alert-700 border border-alert-200 hover:bg-alert-50',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
}

const BASE =
  'inline-flex items-center justify-center font-medium rounded-lg transition whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 ' +
  'disabled:opacity-50 disabled:pointer-events-none'

type CommonProps = {
  variant?: Variant
  size?: Size
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  href,
  ...rest
}: CommonProps &
  (
    | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
    | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  )) {
  const cls = clsx(BASE, VARIANTS[variant], SIZES[size], className)
  const inner = (
    <>
      {icon}
      {children}
    </>
  )

  if (href) {
    const isExternal = /^https?:|^\/api\//.test(href)
    if (isExternal) {
      return (
        <a href={href} className={cls} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {inner}
        </a>
      )
    }
    return (
      <Link href={href} className={cls} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </Link>
    )
  }

  return (
    <button className={cls} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  )
}
