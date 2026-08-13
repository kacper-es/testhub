import { prisma } from '@/lib/prisma'
import { todayInWarsaw } from '@/lib/date'
import {
  appVersionWhere,
  getFilterApps,
  parseAppFilter,
} from '@/lib/versions/app-filter'
import { LivePolling } from '@/components/versions/LivePolling'
import { VersionCard } from '@/components/versions/VersionCard'
import { AppFilterNav } from '@/components/versions/AppFilterNav'

const APP_SELECT = {
  id: true,
  name: true,
  iconType: true,
  iconUpdatedAt: true,
} as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>
}) {
  const today = todayInWarsaw()
  const { app } = await searchParams
  const appFilter = parseAppFilter(app)

  const scopeWhere = { status: 'IN_PROGRESS' as const }
  const [versions, filterApps] = await Promise.all([
    prisma.version.findMany({
      where: { ...scopeWhere, ...appVersionWhere(appFilter) },
      orderBy: { releaseDate: 'asc' },
      include: {
        tasks: { include: { taskTemplate: true } },
        testRuns: { include: { values: true } },
        columns: { where: { excludedAt: null } },
        application: { select: APP_SELECT },
      },
    }),
    getFilterApps(scopeWhere),
  ])

  const hrefFor = (value: string) =>
    value === 'all' ? '/' : `/?app=${encodeURIComponent(value)}`

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      {/* Polling 5 s — dashboard i widok wersji (reguła 7). */}
      <LivePolling />

      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Wersje w przygotowaniu</h1>

        <AppFilterNav
          apps={filterApps.apps}
          hasNone={filterApps.hasNone}
          current={appFilter}
          hrefFor={hrefFor}
        />

        {versions.length === 0 ? (
          <p className="text-muted">
            {appFilter === 'all'
              ? 'Brak wersji w przygotowaniu — dodaj pierwszą.'
              : 'Brak wersji w przygotowaniu dla tego filtra.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {versions.map((version) => (
              <VersionCard key={version.id} version={version} today={today} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
