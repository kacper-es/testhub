import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/session'
import { todayInWarsaw } from '@/lib/date'
import { logout } from '@/app/actions/auth'
import {
  appVersionWhere,
  getFilterApps,
  parseAppFilter,
} from '@/lib/versions/app-filter'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
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
  // Gwarantowane przez layout (app).
  const user = await getSessionUser()
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
        testRuns: true,
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

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Release Hub</h1>
          <p className="mt-1 text-sm text-muted">
            Zalogowano jako <strong>{user?.name}</strong> (
            <span className="font-mono">{user?.role}</span>)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user && <ThemeToggle current={user.theme} />}
          <form action={logout}>
            <Button variant="secondary" type="submit">
              Wyloguj
            </Button>
          </form>
        </div>
      </header>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/versions">
          Zarządzanie wersjami →
        </Link>
        <Link className="underline" href="/instances">
          Katalog instancji →
        </Link>
        <Link className="underline" href="/archive">
          Archiwum →
        </Link>
        {user?.role === 'ADMIN' && (
          <Link className="underline" href="/admin">
            Panel administratora →
          </Link>
        )}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Wersje w przygotowaniu</h2>

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
