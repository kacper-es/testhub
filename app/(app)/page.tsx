import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/session'
import { todayInWarsaw } from '@/lib/date'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LivePolling } from '@/components/versions/LivePolling'
import { VersionCard } from '@/components/versions/VersionCard'

export default async function DashboardPage() {
  // Gwarantowane przez layout (app).
  const user = await getSessionUser()
  const today = todayInWarsaw()

  const versions = await prisma.version.findMany({
    where: { status: 'IN_PROGRESS' },
    orderBy: { releaseDate: 'asc' },
    include: {
      tasks: { include: { taskTemplate: true } },
      testRuns: true,
    },
  })

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
        <Link className="underline" href="/archive">
          Archiwum →
        </Link>
        <Link className="text-muted underline" href="/design">
          Galeria komponentów →
        </Link>
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Wersje w przygotowaniu</h2>
        {versions.length === 0 ? (
          <p className="text-muted">
            Brak wersji w przygotowaniu — dodaj pierwszą.
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
