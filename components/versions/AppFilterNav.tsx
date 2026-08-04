import Link from 'next/link'
import type { FilterApp } from '@/lib/versions/app-filter'
import { AppIcon } from '@/components/versions/AppIcon'
import { cn } from '@/lib/cn'

// Chipy filtra po aplikacji (GET, bez klienta — wzorzec z /archive).
// `hrefFor(value)` buduje link zachowując inne parametry strony.
export function AppFilterNav({
  apps,
  hasNone,
  current,
  hrefFor,
}: {
  apps: FilterApp[]
  hasNone: boolean
  current: string
  hrefFor: (value: string) => string
}) {
  if (apps.length === 0 && !hasNone) return null

  const chip = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
      active
        ? 'border-fg bg-fg text-bg'
        : 'border-border bg-surface text-fg hover:bg-surface-raised',
    )

  return (
    <nav className="flex flex-wrap gap-2">
      <Link href={hrefFor('all')} className={chip(current === 'all')}>
        Wszystkie
      </Link>
      {apps.map((a) => (
        <Link
          key={a.id}
          href={hrefFor(a.id)}
          className={chip(current === a.id)}
        >
          <AppIcon app={a} />
          {a.name}
        </Link>
      ))}
      {hasNone && (
        <Link href={hrefFor('none')} className={chip(current === 'none')}>
          Bez aplikacji
        </Link>
      )}
    </nav>
  )
}
