import { prisma } from '@/lib/prisma'
import { todayInWarsaw } from '@/lib/date'
import {
  appVersionWhere,
  getFilterApps,
  parseAppFilter,
} from '@/lib/versions/app-filter'
import { LivePolling } from '@/components/versions/LivePolling'
import { VersionCard } from '@/components/versions/VersionCard'
import { jiraCountsByVersion } from '@/lib/jira/counts'
import { readJiraConfig } from '@/lib/jira/config'
import { AppFilterNav } from '@/components/versions/AppFilterNav'
import { Card, Eyebrow } from '@/components/ui/Card'
import { summarizeVersion } from '@/lib/versions/summary'
import { cn } from '@/lib/cn'

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
        tasks: { where: { excludedAt: null }, include: { taskTemplate: true } },
        testRuns: { include: { values: true } },
        columns: { where: { excludedAt: null } },
        application: { select: APP_SELECT },
      },
    }),
    getFilterApps(scopeWhere),
  ])

  // Liczby ticketów z Jiry dla zadań TICKET_AGGREGATE (J-4) — jedno zapytanie.
  const jiraCounts = await jiraCountsByVersion(
    versions.filter((v) => v.jiraVersionId !== null).map((v) => v.id),
  )
  const jiraConfigured = readJiraConfig().status === 'configured'

  const hrefFor = (value: string) =>
    value === 'all' ? '/' : `/?app=${encodeURIComponent(value)}`

  // UI-2c: podsumowanie każdej wersji raz — karty i pasek KPI z tych samych danych.
  const cards = versions.map((version) => ({
    version,
    summary: summarizeVersion(
      version,
      today,
      jiraCounts.get(version.id) ?? null,
      jiraConfigured,
    ),
  }))
  const next = cards[0]
  const tasksTotal = cards.reduce((n, c) => n + c.summary.tasks.length, 0)
  const tasksDone = cards.reduce((n, c) => n + c.summary.tasksDone, 0)
  const overdue = cards.reduce((n, c) => n + c.summary.overdueOpen, 0)
  const instancesTotal = cards.reduce((n, c) => n + c.summary.instanceAgg.total, 0)
  const instancesDone = cards.reduce((n, c) => n + c.summary.instanceAgg.done, 0)

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-8">
      {/* Polling 5 s — dashboard i widok wersji (reguła 7). */}
      <LivePolling />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Dashboard</Eyebrow>
          <h1 className="m-0 text-3xl font-bold tracking-tight">Wersje w przygotowaniu</h1>
        </div>
        <AppFilterNav
          apps={filterApps.apps}
          hasNone={filterApps.hasNone}
          current={appFilter}
          hrefFor={hrefFor}
        />
      </header>

      {cards.length > 0 && (
        <section aria-label="Podsumowanie" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="flex flex-col gap-2">
            <Eyebrow>Najbliższe wydanie</Eyebrow>
            <span
              className={cn(
                'font-mono text-3xl font-bold leading-none',
                next.summary.urgency.level === 'fail' && 'text-fail-strong',
                next.summary.urgency.level === 'warn' && 'text-warn-strong',
              )}
            >
              {next.summary.daysLeft < 0
                ? `T+${-next.summary.daysLeft}`
                : `T−${next.summary.daysLeft}`}
            </span>
            <span className="truncate font-mono text-xs text-muted">{next.version.name}</span>
          </Card>
          <Card className="flex flex-col gap-2">
            <Eyebrow>Otwarte wersje</Eyebrow>
            <span className="font-mono text-3xl font-bold leading-none">{cards.length}</span>
            <span className="font-mono text-xs text-muted">
              {instancesDone}/{instancesTotal} instancji gotowych
            </span>
          </Card>
          <Card className="flex flex-col gap-2">
            <Eyebrow>Zadania gotowe</Eyebrow>
            <span className="font-mono text-3xl font-bold leading-none">
              {tasksDone}
              <span className="text-muted">/{tasksTotal}</span>
            </span>
            <div className="h-1.5 bg-border" aria-hidden>
              <div
                className="h-full bg-pass"
                style={{ width: `${tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0}%` }}
              />
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <Eyebrow>Po terminie</Eyebrow>
            <span
              className={cn(
                'font-mono text-3xl font-bold leading-none',
                overdue > 0 ? 'text-fail-strong' : 'text-fg',
              )}
            >
              {overdue}
            </span>
            <span className="font-mono text-xs text-muted">otwartych zadań</span>
          </Card>
        </section>
      )}

      {cards.length === 0 ? (
        <p className="text-muted">
          {appFilter === 'all'
            ? 'Brak wersji w przygotowaniu — dodaj pierwszą.'
            : 'Brak wersji w przygotowaniu dla tego filtra.'}
        </p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {cards.map(({ version, summary }) => (
            <VersionCard key={version.id} version={version} summary={summary} />
          ))}
        </div>
      )}
    </main>
  )
}
