import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// Panel „Telemetria" (UI-2a): ostre rogi, hairline border, znacznik sygnału
// w lewym górnym rogu (dekoracja, pseudo-element).
export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[4px] border border-border bg-surface p-5",
        "before:pointer-events-none before:absolute before:-left-px before:-top-px before:h-2.5 before:w-2.5 before:border-l before:border-t before:border-signal before:content-['']",
        className,
      )}
      {...props}
    />
  )
}

// Etykieta sekcji/kafla: mono, wersaliki, rozstrzelona.
export function Eyebrow({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('font-mono text-[11px] uppercase tracking-[0.12em] text-muted', className)}
      {...props}
    />
  )
}
