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
import {
  AttachInstance,
  type AttachOption,
} from '@/components/versions/AttachInstance'
import { CommentForm } from '@/components/versions/CommentForm'
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
        include: { instance: true },
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
    },
  })
  if (!version) notFound()

  const today = todayInWarsaw()
  const closed = version.status !== 'IN_PROGRESS'
  const disabled = !canEdit || closed
  const vs = VERSION_STATUS[version.status]

  // Agregat instancji wspólny dla wszystkich zadań INSTANCE_AGGREGATE (reguła 16).
  const instanceAgg = instanceAggregateStatus(version.testRuns)

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

  // „Podepnij instancję": aktywne instancje bez aktywnego runu (brak lub odpięty).
  const runByInstanceId = new Map(
    version.testRuns.map((r) => [r.instanceId, r]),
  )
  const activeInstances = await prisma.instance.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  const attachOptions: AttachOption[] = activeInstances
    .filter((i) => {
      const r = runByInstanceId.get(i.id)
      return !r || r.excludedAt !== null
    })
    .map((i) => ({
      id: i.id,
      name: i.name,
      hadData: runByInstanceId.has(i.id),
    }))

  const rows = version.tasks
    .map((task) => ({
      task,
      resolved: resolveTask(task, task.taskTemplate, version.status),
    }))
    .sort((a, b) => a.resolved.sortOrder - b.resolved.sortOrder)

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

                  {resolved.taskType === 'TICKET_AGGREGATE' && (
                    <div className="flex flex-col items-end gap-1">
                      <TaskStatusBadge
                        status={ticketAggregateStatus(
                          task.manualCounterCurrent,
                          task.manualCounterTotal,
                        )}
                      />
                      <TicketCounterControl
                        versionTaskId={task.id}
                        current={task.manualCounterCurrent}
                        total={task.manualCounterTotal}
                        disabled={disabled}
                      />
                    </div>
                  )}

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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Instancje</h2>
        <InstanceRunsTable
          runs={activeRuns}
          disabled={disabled}
          lastChanges={lastChanges}
        />
        {!disabled && (
          <AttachInstance versionId={version.id} options={attachOptions} />
        )}
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
    </main>
  )
}
