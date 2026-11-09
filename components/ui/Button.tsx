import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-[3px] px-4 py-2 text-sm font-medium ' +
  'transition-colors disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  // Akcent „Telemetria": limonka na ciemnym, grafit z limonkowym tekstem na jasnym.
  primary: 'bg-accent font-semibold text-on-accent hover:opacity-90',
  secondary: 'bg-transparent text-fg border border-border-strong hover:bg-surface-raised',
  ghost: 'bg-transparent text-fg hover:bg-surface-raised',
  // Danger jako outline w dostępnym wariancie czerwieni (kontrast ≥ 4,5:1).
  danger: 'bg-transparent text-fail-strong border border-fail-strong hover:bg-surface-raised',
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />
}
