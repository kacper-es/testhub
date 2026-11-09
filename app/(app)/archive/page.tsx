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
import { todayInWarsaw } from '@/lib/date'
import { monthlyClosed } from '@/lib/versions/overview'
import { Eyebrow } from '@/components/ui/Card'

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

  // UI-2c: wykres zamkniętych wersji wg miesiąca wydania (12 mies., wg filtrów).
  const buckets = monthlyClosed(
    versions.map((v) => ({
      releaseDay: toDateOnly(v.releaseDate),
      status: v.status as 'RELEASED' | 'CANCELLED',
    })),
    todayInWarsaw(),
  )
  const maxBucket = Math.max(1, ...buckets.map((b) => b.released + b.cancelled))
  const released = versions.filter((v) => v.status === 'RELEASED').length
  const cancelled = versions.length - released

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Zamknięte wersje</Eyebrow>
        <h1 className="m-0 text-3xl font-bold tracking-tight">Archiwum</h1>
      </div>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={archiveHref(f.key, appFilter)}
            className={cn(
              'rounded-[3px] border px-3 py-1 text-sm',
              f.key === filter
                ? 'border-accent bg-accent text-on-accent'
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

      {versions.length > 0 && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0">
              <Eyebrow>Wydania · ostatnie 12 miesięcy</Eyebrow>
            </h2>
            <span className="flex gap-4 font-mono text-xs text-muted">
              <span>
                <span aria-hidden className="mr-1.5 inline-block h-2 w-2 bg-pass" />
                wydane {released}
              </span>
              <span>
                <span aria-hidden className="mr-1.5 inline-block h-2 w-2 bg-fail" />
                anulowane {cancelled}
              </span>
            </span>
          </div>
          <div
            className="grid h-36 grid-cols-12 items-end gap-1.5"
            role="img"
            aria-label={`Zamknięte wersje wg miesiąca: ${buckets
              .map((b) => `${b.month} — ${b.released} wydanych, ${b.cancelled} anulowanych`)
              .join('; ')}`}
          >
            {buckets.map((b) => (
              <div key={b.month} className="flex h-full flex-col items-stretch justify-end gap-0.5">
                {b.cancelled > 0 && (
                  <div className="bg-fail" style={{ height: `${(b.cancelled / maxBucket) * 100}%` }} />
                )}
                {b.released > 0 && (
                  <div className="bg-pass" style={{ height: `${(b.released / maxBucket) * 100}%` }} />
                )}
                {b.released + b.cancelled === 0 && <div className="h-px bg-border-strong" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-1.5 font-mono text-[10px] text-muted">
            {buckets.map((b) => (
              <span key={b.month} className="text-center">
                {b.month.slice(5, 7)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {versions.length === 0 ? (
        <p className="text-muted">Brak wersji w tym filtrze.</p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {versions.map((v) => {
            const s = STATUS[v.status as 'RELEASED' | 'CANCELLED']
            return (
              <Card key={v.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/versions/${v.id}`}
                      className="inline-flex items-center gap-2 font-mono text-lg font-bold underline-offset-4 hover:underline"
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
