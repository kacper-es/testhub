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
import { resolveDeadline, toDateOnly } from '@/lib/versions/deadline'
import { TASK_STATUS_META } from '@/lib/versions/task-status'
import { Card } from '@/components/ui/Card'
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
import { DeleteVersion } from '@/components/versions/DeleteVersion'
import Link from 'next/link'
import { AppIcon } from '@/components/versions/AppIcon'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

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

// Kategoria statusu Jiry → kolor odznaki (J-4).
const JIRA_CATEGORY_BADGE: Record<string, BadgeStatus> = {
  new: 'neutral',
  indeterminate: 'warn',
  done: 'pass',
}

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
    return <span className="text-xs text-muted">elastyczny</span>
  }

  const cls =
    info.urgency.level === 'pass'
      ? 'text-pass-strong'
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
      tasks: { include: { taskTemplate: true } },
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

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      {/* Polling 5 s — odświeża Server Components (sekcja 7). */}
      {!closed && <LivePolling />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 font-mono text-2xl font-semibold">
            <AppIcon app={version.application} />
            {version.name}
          </h1>
          <StatusBadge status={vs.badge}>{vs.label}</StatusBadge>
          <span className="font-mono text-sm text-muted">
            wydanie {toDateOnly(version.releaseDate)}
          </span>
        </div>

        {!disabled && (
          <Link href={`/versions/${version.id}/edit`}>
            <Button variant="secondary">Edytuj wersję</Button>
          </Link>
        )}
      </div>

      {closed && (
        <div
          role="status"
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted"
        >
          Wersja zamknięta — tylko do odczytu.
          {version.status === 'CANCELLED' && version.cancelReason && (
            <span className="text-fail-strong"> Anulowano: {version.cancelReason}</span>
          )}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Checklista</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            Brak zadań w tej wersji — w chwili utworzenia nie było aktywnych
            szablonów.
          </p>
        ) : (
          rows.map(({ task, resolved }) => (
            <Card key={task.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-fg">{resolved.name}</span>
                  {resolved.description && (
                    <span className="text-sm text-muted">
                      {resolved.description}
                    </span>
                  )}
                  <DeadlineLabel
                    releaseDate={version.releaseDate}
                    resolved={resolved}
                    today={today}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-3">
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
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <TaskStatusBadge status={t.status} />
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
                          {t.mode === 'jira' && (
                            <span className="text-xs text-muted">z Jiry</span>
                          )}
                          {t.mode === 'jira-unsynced' && (
                            <span className="text-xs text-muted">Nie zsynchronizowano z Jirą</span>
                          )}
                          {t.mode === 'unmapped' && (
                            <span className="text-xs text-muted">Niepodpięta do Jira</span>
                          )}
                        </div>
                      )
                    })()}

                  {resolved.taskType === 'INSTANCE_AGGREGATE' && (
                    <div
                      className="flex cursor-default flex-col items-end gap-1"
                      title="Status wyliczany z gotowości instancji"
                    >
                      <TaskStatusBadge status={instanceAgg.status} />
                      <StepDots done={instanceAgg.done} total={instanceAgg.total} />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </section>

      {version.jiraVersionId && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Tickety Jira</h2>
            <span className="font-mono text-sm text-muted">
              {version.jiraVersionName}
              {version.jiraSyncedAt
                ? ` · ${jiraDone}/${jiraIssues.length} gotowych · synchronizacja ${whenFmt.format(version.jiraSyncedAt)}`
                : ''}
            </span>
          </div>
          {!version.jiraSyncedAt ? (
            <p className="text-sm text-muted">
              Tickety nie były jeszcze synchronizowane — administrator robi to w edycji wersji.
            </p>
          ) : sortedIssues.length === 0 ? (
            <p className="text-sm text-muted">Brak ticketów w tej wersji Jira.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {sortedIssues.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  {jiraBrowseUrl ? (
                    <a
                      href={`${jiraBrowseUrl}${encodeURIComponent(i.key)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-fg underline underline-offset-2"
                    >
                      {i.key}
                    </a>
                  ) : (
                    <span className="font-mono text-fg">{i.key}</span>
                  )}
                  <span className="min-w-0 flex-1 text-fg">{i.summary}</span>
                  <span className="text-xs text-muted">{i.issueType}</span>
                  {i.assigneeName && (
                    <span className="text-xs text-muted">{i.assigneeName}</span>
                  )}
                  <StatusBadge status={JIRA_CATEGORY_BADGE[i.statusCategory] ?? 'neutral'}>
                    {i.statusName}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Instancje</h2>
        <InstanceRunsTable
          runs={activeRuns}
          columns={activeColumns.map((c) => ({ id: c.id, name: c.name }))}
          values={valueMap}
          disabled={disabled}
          lastChanges={lastChanges}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Komentarze</h2>
        {!disabled && <CommentForm versionId={version.id} />}

        {version.comments.length === 0 ? (
          <p className="text-sm text-muted">Brak komentarzy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {version.comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-fg">
                    {c.author.name}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {commentFmt.format(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-fg">
                  {c.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.role === 'ADMIN' && (
        <section className="flex flex-col gap-3 rounded-lg border border-fail-strong p-4">
          <div>
            <h2 className="text-lg font-semibold">Usuń wersję</h2>
            <p className="mt-1 text-sm text-muted">
              Usuwa wersję na stałe razem z zadaniami, instancjami, notatkami, komentarzami
              i krokami. Tej operacji nie można cofnąć. W logu zmian zostanie wpis o usunięciu.
            </p>
          </div>
          <DeleteVersion versionId={version.id} versionName={version.name} />
        </section>
      )}
    </main>
  )
}
