import { cn } from '@/lib/cn'

// Marka aplikacji: znak „RH" + nazwa. Tylko tokeny, bez zewnętrznych assetów.
export function Wordmark({
  subtitle,
  className,
}: {
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-fg font-mono text-lg font-bold text-bg"
      >
        RH
      </span>
      <div>
        <p className="text-xl font-semibold">Release Hub</p>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
    </div>
  )
}
