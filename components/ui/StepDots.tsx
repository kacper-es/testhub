import { cn } from '@/lib/cn'

// Element sygnaturowy (sekcja 9.3): rząd kwadracików wypełnianych kolorem.
// Przy dużym `total` grupujemy do CAP kropek proporcjonalnie + licznik X/Y.
const CAP = 40

export function StepDots({
  done,
  total,
  className,
}: {
  done: number
  total: number
  className?: string
}) {
  if (total <= 0) {
    return <span className="font-mono text-sm text-muted">—</span>
  }

  const shown = Math.min(total, CAP)
  const filled = total <= CAP ? done : Math.round((done / total) * CAP)

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className="inline-flex flex-wrap gap-1"
        role="img"
        aria-label={`${done} z ${total} gotowych`}
      >
        {Array.from({ length: shown }).map((_, i) => {
          const isFilled = i < filled
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'h-2.5 w-2.5 rounded-[3px] border',
                isFilled
                  ? 'animate-dot-fill border-pass-strong bg-pass'
                  : 'border-border bg-transparent',
              )}
              style={
                isFilled
                  ? { animationDelay: `${Math.min(i, 12) * 30}ms` }
                  : undefined
              }
            />
          )
        })}
      </span>
      <span className="font-mono text-xs text-muted">
        {done}/{total}
      </span>
    </span>
  )
}
