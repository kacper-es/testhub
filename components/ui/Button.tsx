import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ' +
  'transition-colors disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  // Neutralny mocny przycisk (odwrócenie tekst/tło) — wysoki kontrast w obu motywach.
  primary: 'bg-fg text-bg hover:opacity-90',
  secondary: 'bg-surface text-fg border border-border hover:bg-surface-raised',
  ghost: 'bg-transparent text-fg hover:bg-surface-raised',
  // Danger jako outline w dostępnym wariancie czerwieni (kontrast ≥ 4,5:1).
  danger: 'bg-surface text-fail-strong border border-fail-strong hover:bg-surface-raised',
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />
}
