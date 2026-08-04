import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

// Wspólna baza kontrolek formularza — jedyne źródło stylu inputów (tokeny CSS
// variables, oba motywy). Zastępuje kopiowane po komponentach stringi `field`/`input`.
const control =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg ' +
  'placeholder:text-muted transition-colors'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, className)} {...props} />
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, className)} {...props} />
}

// Etykietowany wrapper pola: <label> + tekst etykiety + opcjonalna podpowiedź.
export function Field({
  label,
  hint,
  optional,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  optional?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-sm font-medium">
        {label}
        {optional && <span className="text-muted"> (opcjonalnie)</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}
