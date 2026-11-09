import { notFound } from 'next/navigation'
import type { TaskStatus, VersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'
import { todayInWarsaw } from '@/lib/date'
import { resolveTask, type ResolvedTask } from '@/lib/versions/resolve-task'
import {
  instanceAggregateStatus,
  ticketAggregateStatus,
} from '@/lib/versions/aggregates'
import { daysRemaining, resolveDeadline, toDateOnly, urgency } from '@/lib/versions/deadline'
import { TASK_STATUS_META } from '@/lib/versions/task-status'
import { Card, Eyebrow } from '@/components/ui/Card'
import { StatusBadge, type BadgeStatus } from '@/components/ui/StatusBadge'
import { StepDots } from '@/components/ui/StepDots'
import { CheckboxTaskControl } from '@/components/versions/CheckboxTaskControl'
import { TicketCounterControl } from '@/components/versions/TicketCounterControl'
import { LivePolling } from '@/components/versions/LivePolling'
import {
  InstanceRunsTable,
  type LastChangeMap,
} from '@/components/versions/InstanceRunsTable'
import { CommentForm } from '@/components/versions/CommentForm'
import { readJiraConfig } from '@/lib/jira/config'
import { ticketTaskView } from '@/lib/versions/ticket-source'
import Link from 'next/link'
import { AppIcon } from '@/components/versions/AppIcon'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { buildBurnup, buildTimeline } from '@/lib/versions/overview'
import { FIELD_LABEL, displayValue } from '@/lib/versions/changelog-labels'
import { ReleaseTimeline } from '@/components/versions/ReleaseTimeline'
import { JiraPanel } from '@/components/versions/JiraPanel'
import { EventLog, type EventLogEntry } from '@/components/versions/EventLog'

// Ostatnia zmiana każdej flagi/notatki, jednym zapytaniem DISTINCT ON (reguła 4 —
// nie per flaga). Zwraca wiersze najświeższej zmiany dla (entityId, field).
type LastChangeRow = {
  entityId: string
  field: string
  userName: string
  createdAt: Date
}

const whenFmt = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Warsaw',
})

const commentFmt = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Warsaw',
})

const VERSION_STATUS: Record<
  VersionStatus,
  { label: string; badge: BadgeStatus }
> = {
  IN_PROGRESS: { label: 'W przygotowaniu', badge: 'warn' },
  RELEASED: { label: 'Wydana', badge: 'pass' },
  CANCELLED: { label: 'Anulowana', badge: 'fail' },
}

const EVENT_LOG_SIZE = 8

const timeFmt = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Warsaw',
})

const dayFmt = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Warsaw',
})

// Data wydania (@db.Date = północ UTC) — formatowana w UTC, by nie przesunąć dnia.
const releaseFmt = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const m = TASK_STATUS_META[status]
  return <StatusBadge status={m.badge}>{m.label}</StatusBadge>
}

// Deadline zadania i pilność — liczone po stronie serwera (reguła 25).
function DeadlineLabel({
  releaseDate,
  resolved,
  today,
}: {
  releaseDate: Date
  resolved: ResolvedTask
  today: string
}) {
  const info = resolveDeadline(
    resolved.deadlineType,
    resolved.daysBeforeRelease,
    releaseDate,
    today,
  )
  if (info.kind === 'flexible') {
    return <span className="font-mono text-xs text-muted">elastyczny</span>
  }

  // UI-2b: a far deadline stays neutral — lime/green means "done" in Telemetria.
  const cls =
    info.urgency.level === 'pass'
      ? 'text-muted'
      : info.urgency.level === 'warn'
        ? 'text-warn-strong'
        : 'text-fail-strong'
  const label = info.urgency.overdue
    ? 'po terminie'
    : info.days === 0
      ? 'dziś'
      : info.days === 1
        ? 'jutro'
        : `za ${info.days} dni`

  return (
    <span className={cn('font-mono text-xs', cls)}>
      {info.deadline} · {label}
    </span>
  )
}

export default async function VersionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const canEdit = user.role === 'TESTER' || user.role === 'ADMIN'

  const version = await prisma.version.findUnique({
    where: { id },
    include: {
      tasks: { where: { excludedAt: null }, include: { taskTemplate: true } },
      testRuns: {
        include: { instance: true, values: true },
        orderBy: { instance: { name: 'asc' } },
      },
      comments: {
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      },
      application: {
        select: {
          id: true,
          name: true,
          iconType: true,
          iconUpdatedAt: true,
        },
      },
      columns: {
        where: { excludedAt: null },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!version) notFound()

  const today = todayInWarsaw()
  const closed = version.status !== 'IN_PROGRESS'
  const disabled = !canEdit || closed
  const vs = VERSION_STATUS[version.status]

  // Aktywne kroki wersji i mapa wartości `${runId}:${versionColumnId}` → bool.
  const activeColumns = version.columns
  const checkboxColumnIds = new Set(
    activeColumns.filter((c) => c.fieldType === 'CHECKBOX').map((c) => c.id),
  )
  const valueMap = new Map<string, boolean>()
  for (const run of version.testRuns) {
    for (const v of run.values) {
      valueMap.set(`${run.id}:${v.versionColumnId}`, v.boolValue)
    }
  }

  // Agregat instancji (reguła 16): licznik zaznaczonych kroków checkbox per run,
  // mianownik = liczba aktywnych kroków checkbox wersji.
  const instanceAgg = instanceAggregateStatus(
    version.testRuns.map((run) => ({
      excludedAt: run.excludedAt,
      trueCount: run.values.filter(
        (v) => checkboxColumnIds.has(v.versionColumnId) && v.boolValue,
      ).length,
    })),
    checkboxColumnIds.size,
  )

  // Ostatnie zmiany flag/notatek — jedno zapytanie DISTINCT ON (reguła 4).
  const lastRows = await prisma.$queryRaw<LastChangeRow[]>`
    SELECT DISTINCT ON (cl."entityId", cl.field)
      cl."entityId" AS "entityId",
      cl.field      AS field,
      u.name        AS "userName",
      cl."createdAt" AS "createdAt"
    FROM "ChangeLog" cl
    JOIN "User" u ON u.id = cl."userId"
    WHERE cl."versionId" = ${version.id}
      AND cl."entityType" = 'InstanceTestRun'
    ORDER BY cl."entityId", cl.field, cl."createdAt" DESC
  `
  const lastChanges: LastChangeMap = new Map(
    lastRows.map((r) => [
      `${r.entityId}:${r.field}`,
      { user: r.userName, when: whenFmt.format(r.createdAt) },
    ]),
  )

  const activeRuns = version.testRuns.filter((r) => r.excludedAt === null)

  const rows = version.tasks
    .map((task) => ({
      task,
      resolved: resolveTask(task, task.taskTemplate, version.status),
    }))
    .sort((a, b) => a.resolved.sortOrder - b.resolved.sortOrder)

  // Tickety z Jiry (J-4) — z lokalnej kopii, bez odpytywania Jiry. Liczby dla zadań
  // TICKET_AGGREGATE z jednego helpera (ten sam co na dashboardzie).
  const jiraCfg = readJiraConfig()
  const jiraIssues = version.jiraVersionId
    ? await prisma.jiraIssue.findMany({
        where: { versionId: version.id, removedAt: null },
        orderBy: { key: 'asc' },
      })
    : []
  const sortedIssues = [...jiraIssues].sort(
    (a, b) =>
      Number(a.statusCategory === 'done') - Number(b.statusCategory === 'done') ||
      a.key.localeCompare(b.key, undefined, { numeric: true }),
  )
  const jiraDone = jiraIssues.filter((i) => i.statusCategory === 'done').length
  const ticketView = (task: { manualCounterCurrent: number; manualCounterTotal: number }) =>
    ticketTaskView({
      versionStatus: version.status,
      jiraMapped: version.jiraVersionId !== null,
      jiraSynced: version.jiraSyncedAt !== null,
      jiraConfigured: jiraCfg.status === 'configured',
      manual: { current: task.manualCounterCurrent, total: task.manualCounterTotal },
      jira: { done: jiraDone, total: jiraIssues.length },
    })
  const jiraBrowseUrl = jiraCfg.status === 'configured' ? `${jiraCfg.config.baseUrl}/browse/` : null

  // --- UI-2b: overview data — all date math on the server (rule 25) ----------
  const releaseDay = toDateOnly(version.releaseDate)
  const daysLeft = daysRemaining(releaseDay, today)
  const releaseLevel = urgency(daysLeft).level

  const effectiveStatus = (
    task: (typeof rows)[number]['task'],
    resolved: ResolvedTask,
  ): TaskStatus =>
    resolved.taskType === 'TICKET_AGGREGATE'
      ? ticketView(task).status
      : resolved.taskType === 'INSTANCE_AGGREGATE'
        ? instanceAgg.status
        : task.status
  const taskStates = rows.map((r) => ({ ...r, status: effectiveStatus(r.task, r.resolved) }))
  const tasksDone = taskStates.filter((t) => t.status === 'DONE').length

  const timeline = buildTimeline(
    today,
    releaseDay,
    taskStates.flatMap(({ task, resolved, status }) => {
      const info = resolveDeadline(
        resolved.deadlineType,
        resolved.daysBeforeRelease,
        version.releaseDate,
        today,
      )
      return info.kind === 'deadline'
        ? [
            {
              id: task.id,
              name: resolved.name,
              deadline: info.deadline,
              done: status === 'DONE',
              level: info.urgency.level,
              overdue: info.urgency.overdue,
            },
          ]
        : []
    }),
  )

  const stepsTotal = activeRuns.length * checkboxColumnIds.size
  const stepsDone = activeRuns.reduce(
    (n, run) =>
      n + run.values.filter((v) => checkboxColumnIds.has(v.versionColumnId) && v.boolValue).length,
    0,
  )

  const snapshots = version.jiraVersionId
    ? await prisma.jiraSnapshot.findMany({
        where: { versionId: version.id },
        orderBy: { day: 'asc' },
        select: { day: true, total: true, done: true },
      })
    : []
  const burnup = buildBurnup(snapshots, today)

  // Log zdarzeń: ostatnie wpisy ChangeLog wersji (treści notatek nie pokazujemy).
  const logRows = await prisma.changeLog.findMany({
    where: { versionId: version.id },
    orderBy: { createdAt: 'desc' },
    take: EVENT_LOG_SIZE,
    include: { user: { select: { name: true } } },
  })
  const runName = new Map(version.testRuns.map((r) => [r.id, r.instance.name]))
  const taskName = new Map(rows.map((r) => [r.task.id, r.resolved.name]))
  const colName = new Map(version.columns.map((c) => [c.id, c.name]))
  const describeChange = (e: (typeof logRows)[number]): string => {
    if (e.entityType === 'InstanceTestRun') {
      const what = FIELD_LABEL[e.field] ?? colName.get(e.field) ?? 'krok'
      const value = e.field === 'notes' ? 'zmiana' : displayValue(e.newValue)
      return `${what} · ${runName.get(e.entityId) ?? 'instancja'}: ${value}`
    }
    if (e.entityType === 'VersionTask') {
      const name = taskName.get(e.entityId) ?? 'zadanie'
      if (e.field === 'status') {
        const meta = TASK_STATUS_META[e.newValue as TaskStatus]
        return `${name}: ${meta ? meta.label.toLowerCase() : displayValue(e.newValue)}`
      }
      return `${name} · ${FIELD_LABEL[e.field] ?? e.field}: ${displayValue(e.newValue)}`
    }
    return `${FIELD_LABEL[e.field] ?? e.field}: ${displayValue(e.newValue)}`
  }
  const events: EventLogEntry[] = logRows.map((e) => ({
    id: e.id,
    when:
      todayInWarsaw(e.createdAt) === today ? timeFmt.format(e.createdAt) : dayFmt.format(e.createdAt),
    user: e.user.name,
    text: describeChange(e),
  }))

  const jiraTile = !version.jiraVersionId
    ? { value: '—', sub: jiraCfg.status === 'configured' ? 'niepodpięta do Jiry' : 'Jira wyłączona' }
    : !version.jiraSyncedAt
      ? { value: '—', sub: 'brak synchronizacji' }
      : {
          value: `${jiraDone}/${jiraIssues.length}`,
          sub: `sync ${whenFmt.format(version.jiraSyncedAt)}`,
        }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-6 sm:px-8">
      {/* Polling 5 s — odświeża Server Components (sekcja 7). */}
      {!closed && <LivePolling />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow>{version.application ? `${version.application.name} / wersja` : 'Wersja'}</Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 flex items-center gap-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
              <AppIcon app={version.application} />
              {version.name}
            </h1>
            <StatusBadge status={vs.badge}>{vs.label}</StatusBadge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!disabled && (
            <Link href={`/versions/${version.id}/edit`}>
              <Button variant="secondary">Edytuj wersję</Button>
            </Link>
          )}
          {/* Closed version: edit is off, deletion (ADMIN) lives on the edit page. */}
          {closed && user.role === 'ADMIN' && (
            <Link href={`/versions/${version.id}/edit`}>
              <Button variant="ghost">Usuń wersję…</Button>
            </Link>
          )}
        </div>
      </header>

      {closed && (
        <div
          role="status"
          className="rounded-[4px] border border-border bg-surface-raised px-4 py-3 text-sm text-muted"
        >
          Wersja zamknięta — tylko do odczytu.
          {version.status === 'CANCELLED' && version.cancelReason && (
            <span className="text-fail-strong"> Anulowano: {version.cancelReason}</span>
          )}
        </div>
      )}

      <section aria-label="Podsumowanie" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex flex-col gap-2">
          <Eyebrow>{closed ? 'Wydanie' : 'Do wydania'}</Eyebrow>
          {closed ? (
            <span className="font-mono text-3xl font-bold leading-none sm:text-4xl">
              {releaseDay.slice(8, 10)}.{releaseDay.slice(5, 7)}
            </span>
          ) : (
            <span
              className={cn(
                'font-mono text-3xl font-bold leading-none sm:text-4xl',
                releaseLevel === 'fail' && 'text-fail-strong',
                releaseLevel === 'warn' && 'text-warn-strong',
              )}
            >
              {daysLeft < 0 ? `T+${-daysLeft}` : `T−${daysLeft}`}
              <span className="text-base font-normal text-muted"> dni</span>
            </span>
          )}
          <span className="font-mono text-xs text-muted">{releaseFmt.format(version.releaseDate)}</span>
        </Card>

        <Card className="flex flex-col gap-2">
          <Eyebrow>Checklista</Eyebrow>
          <span className="font-mono text-3xl font-bold leading-none sm:text-4xl">
            {tasksDone}
            <span className="text-muted">/{rows.length}</span>
          </span>
          <div
            className="mt-1 flex gap-[3px]"
            role="img"
            aria-label={`${tasksDone} z ${rows.length} zadań gotowych`}
          >
            {taskStates.map(({ task, status }) => (
              <span
                key={task.id}
                className={cn(
                  'h-1.5 flex-1',
                  status === 'DONE'
                    ? 'bg-pass'
                    : status === 'IN_PROGRESS'
                      ? 'bg-warn'
                      : 'bg-border-strong',
                )}
              />
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <Eyebrow>Instancje gotowe</Eyebrow>
          <span className="font-mono text-3xl font-bold leading-none sm:text-4xl">
            {instanceAgg.done}
            <span className="text-muted">/{instanceAgg.total}</span>
          </span>
          <span className="font-mono text-xs text-muted">
            {stepsTotal > 0
              ? `${stepsDone} z ${stepsTotal} kroków · ${Math.round((stepsDone / stepsTotal) * 100)}%`
              : 'brak kroków'}
          </span>
        </Card>

        <Card className="flex flex-col gap-2">
          <Eyebrow>Tickety Jira</Eyebrow>
          <span className="font-mono text-3xl font-bold leading-none sm:text-4xl">{jiraTile.value}</span>
          <span className="font-mono text-xs text-muted">{jiraTile.sub}</span>
        </Card>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          <Card className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="m-0">
                <Eyebrow>Checklista i terminy</Eyebrow>
              </h2>
              <span className="font-mono text-xs text-muted">
                dziś {today.slice(8, 10)}.{today.slice(5, 7)}
              </span>
            </div>

            {timeline.markers.length > 0 && <ReleaseTimeline timeline={timeline} />}

            {rows.length === 0 ? (
              <p className="text-sm text-muted">
                Brak zadań w tej wersji — w chwili utworzenia nie było aktywnych szablonów.
              </p>
            ) : (
              // UI-1: one compact row per task; description in a tooltip (+ sr-only).
              <ul className="m-0 flex list-none flex-col divide-y divide-border border-t border-border p-0">
            {rows.map(({ task, resolved }, i) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span aria-hidden className="w-6 font-mono text-xs text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'font-medium text-fg',
                      resolved.description && 'cursor-help underline decoration-dotted decoration-border-strong underline-offset-4',
                    )}
                    title={resolved.description ?? undefined}
                  >
                    {resolved.name}
                  </span>
                  {resolved.description && (
                    <span className="sr-only">{resolved.description}</span>
                  )}
                  <DeadlineLabel
                    releaseDate={version.releaseDate}
                    resolved={resolved}
                    today={today}
                  />
                </div>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                  {resolved.taskType === 'CHECKBOX' && (
                    <CheckboxTaskControl
                      versionTaskId={task.id}
                      status={task.status}
                      disabled={disabled}
                    />
                  )}

                  {resolved.taskType === 'TICKET_AGGREGATE' &&
                    (() => {
                      const t = ticketView(task)
                      const note =
                        t.mode === 'jira'
                          ? 'z Jiry'
                          : t.mode === 'jira-unsynced'
                            ? 'Nie zsynchronizowano z Jirą'
                            : t.mode === 'unmapped'
                              ? 'Niepodpięta do Jira'
                              : null
                      return (
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          {note && <span className="text-xs text-muted">{note}</span>}
                          {t.mode === 'manual-edit' ? (
                            <TicketCounterControl
                              versionTaskId={task.id}
                              current={t.current}
                              total={t.total}
                              disabled={disabled}
                            />
                          ) : (
                            <span className="font-mono text-sm text-fg">
                              {t.total === 0 ? '—' : `${t.current}/${t.total}`}
                            </span>
                          )}
                          <TaskStatusBadge status={t.status} />
                        </div>
                      )
                    })()}

                  {resolved.taskType === 'INSTANCE_AGGREGATE' && (
                    <div
                      className="flex cursor-default items-center gap-3"
                      title="Status wyliczany z gotowości instancji"
                    >
                      <StepDots done={instanceAgg.done} total={instanceAgg.total} />
                      <TaskStatusBadge status={instanceAgg.status} />
                    </div>
                  )}
                </div>
              </li>
            ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="m-0">
                <Eyebrow>Instancje × kroki</Eyebrow>
              </h2>
              {stepsTotal > 0 && (
                <span className="font-mono text-xs text-muted">
                  {stepsDone}/{stepsTotal}
                </span>
              )}
            </div>
            <InstanceRunsTable
              runs={activeRuns}
              columns={activeColumns.map((c) => ({ id: c.id, name: c.name }))}
              values={valueMap}
              disabled={disabled}
              lastChanges={lastChanges}
            />
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          {version.jiraVersionId && (
            <JiraPanel
              jiraVersionName={version.jiraVersionName}
              syncedText={version.jiraSyncedAt ? `sync ${whenFmt.format(version.jiraSyncedAt)}` : null}
              issues={sortedIssues}
              burnup={burnup}
              browseUrl={jiraBrowseUrl}
            />
          )}

          <EventLog
            entries={events}
            fullLogHref={user.role === 'ADMIN' ? `/admin/changelog?versionId=${version.id}` : null}
          />

          <Card className="flex flex-col gap-3">
            <h2 className="m-0">
              <Eyebrow>Komentarze</Eyebrow>
            </h2>
            {!disabled && <CommentForm versionId={version.id} />}
            {version.comments.length === 0 ? (
              <p className="text-sm text-muted">Brak komentarzy.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
                {version.comments.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-fg">{c.author.name}</span>
                      <span className="font-mono text-[11px] text-muted">
                        {commentFmt.format(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{c.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}
