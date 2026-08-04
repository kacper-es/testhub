import Link from 'next/link'
import type { VersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'
import { toDateOnly } from '@/lib/versions/deadline'
import {
  appVersionWhere,
  getFilterApps,
  parseAppFilter,
} from '@/lib/versions/app-filter'
import { Card } from '@/components/ui/Card'
import { StatusBadge, type BadgeStatus } from '@/components/ui/StatusBadge'
import { AppIcon } from '@/components/versions/AppIcon'
import { AppFilterNav } from '@/components/versions/AppFilterNav'
import { cn } from '@/lib/cn'

const STATUS: Record<
  Extract<VersionStatus, 'RELEASED' | 'CANCELLED'>,
  { label: string; badge: BadgeStatus }
> = {
  RELEASED: { label: 'Wydana', badge: 'pass' },
  CANCELLED: { label: 'Anulowana', badge: 'fail' },
}

type Filter = 'all' | 'released' | 'cancelled'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'released', label: 'Wydane' },
  { key: 'cancelled', label: 'Anulowane' },
]

// Buduje /archive?… zachowując oba filtry (status + aplikacja), pomijając domyślne.
function archiveHref(status: Filter, appValue: string): string {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (appValue !== 'all') params.set('app', appValue)
  const qs = params.toString()
  return qs ? `/archive?${qs}` : '/archive'
}

const closedFmt = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Warsaw',
})

function parseFilter(value: string | undefined): Filter {
  return value === 'released' || value === 'cancelled' ? value : 'all'
}

function statusesFor(filter: Filter): VersionStatus[] {
  if (filter === 'released') return ['RELEASED']
  if (filter === 'cancelled') return ['CANCELLED']
  return ['RELEASED', 'CANCELLED']
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; app?: string }>
}) {
  await requireUser()
  const { status, app } = await searchParams
  const filter = parseFilter(status)
  const appFilter = parseAppFilter(app)

  const scopeWhere = { status: { in: statusesFor(filter) } }
  const [versions, filterApps] = await Promise.all([
    prisma.version.findMany({
      where: { ...scopeWhere, ...appVersionWhere(appFilter) },
      orderBy: { statusChangedAt: 'desc' },
      include: {
        statusChangedBy: true,
        application: {
          select: {
            id: true,
            name: true,
            iconType: true,
            iconUpdatedAt: true,
          },
        },
      },
    }),
    getFilterApps(scopeWhere),
  ])

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <Link href="/" className="text-sm text-muted underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Archiwum</h1>
      </div>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={archiveHref(f.key, appFilter)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              f.key === filter
                ? 'border-fg bg-fg text-bg'
                : 'border-border bg-surface text-fg hover:bg-surface-raised',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <AppFilterNav
        apps={filterApps.apps}
        hasNone={filterApps.hasNone}
        current={appFilter}
        hrefFor={(value) => archiveHref(filter, value)}
      />

      {versions.length === 0 ? (
        <p className="text-muted">Brak wersji w tym filtrze.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v) => {
            const s = STATUS[v.status as 'RELEASED' | 'CANCELLED']
            return (
              <Card key={v.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/versions/${v.id}`}
                      className="inline-flex items-center gap-2 font-mono text-lg underline"
                    >
                      <AppIcon app={v.application} />
                      {v.name}
                    </Link>
                    <StatusBadge status={s.badge}>{s.label}</StatusBadge>
                  </div>
                  <span className="font-mono text-sm text-muted">
                    wydanie {toDateOnly(v.releaseDate)}
                  </span>
                </div>

                {v.statusChangedAt && (
                  <p className="text-xs text-muted">
                    Zamknięto: {v.statusChangedBy?.name ?? '—'},{' '}
                    {closedFmt.format(v.statusChangedAt)}
                  </p>
                )}

                {v.status === 'CANCELLED' && v.cancelReason && (
                  <p className="text-sm text-fail-strong">
                    Powód anulowania: {v.cancelReason}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
