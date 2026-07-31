import Link from 'next/link'
import type { Prisma, TaskStatus } from '@prisma/client'
import { resolveTask } from '@/lib/versions/resolve-task'
import {
  daysRemaining,
  resolveDeadline,
  toDateOnly,
  urgency,
} from '@/lib/versions/deadline'
import {
  instanceAggregateStatus,
  ticketAggregateStatus,
} from '@/lib/versions/aggregates'
import { TASK_STATUS_META } from '@/lib/versions/task-status'
import { StatusBadge, type BadgeStatus } from '@/components/ui/StatusBadge'
import { StepDots } from '@/components/ui/StepDots'
import { cn } from '@/lib/cn'

// Karta wersji IN_PROGRESS na dashboardzie (sekcja 8.2). Klikalna do widoku wersji.
export type DashboardVersion = Prisma.VersionGetPayload<{
  include: {
    tasks: { include: { taskTemplate: true } }
    testRuns: true
  }
}>

const DOT_BG: Record<BadgeStatus, string> = {
  pass: 'bg-pass',
  warn: 'bg-warn',
  fail: 'bg-fail',
  neutral: 'bg-muted',
}

const URGENCY_TEXT = {
  pass: 'text-pass-strong',
  warn: 'text-warn-strong',
  fail: 'text-fail-strong',
} as const

export function VersionCard({
  version,
  today,
}: {
  version: DashboardVersion
  today: string
}) {
  const instanceAgg = instanceAggregateStatus(version.testRuns)

  const tasks = version.tasks
    .map((task) => {
      const resolved = resolveTask(task, task.taskTemplate, version.status)
      let status: TaskStatus
      if (resolved.taskType === 'CHECKBOX') {
        status = task.status
      } else if (resolved.taskType === 'TICKET_AGGREGATE') {
        status = ticketAggregateStatus(
          task.manualCounterCurrent,
          task.manualCounterTotal,
        )
      } else {
        status = instanceAgg.status
      }
      return { id: task.id, resolved, status }
    })
    .sort((a, b) => a.resolved.sortOrder - b.resolved.sortOrder)

  const tasksDone = tasks.filter((t) => t.status === 'DONE').length

  // Odliczanie na poziomie wersji — progi reguły 26, liczone serwerowo.
  const days = daysRemaining(toDateOnly(version.releaseDate), today)
  const u = urgency(days)
  const countdown = u.overdue
    ? 'po terminie'
    : days === 0
      ? 'dziś'
      : days === 1
        ? 'jutro'
        : `za ${days} dni`

  return (
    <Link
      href={`/versions/${version.id}`}
      className="block rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-lg font-semibold">{version.name}</span>
        <StatusBadge status={u.level}>{countdown}</StatusBadge>
      </div>
      <div className="mt-1 font-mono text-xs text-muted">
        wydanie {toDateOnly(version.releaseDate)}
      </div>

      <div className="mt-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted">Brak zadań w tej wersji.</p>
        ) : (
          <>
            <StepDots done={tasksDone} total={tasks.length} />
            <ul className="mt-2 flex flex-col gap-1">
              {tasks.map((t) => {
                const meta = TASK_STATUS_META[t.status]
                const info = resolveDeadline(
                  t.resolved.deadlineType,
                  t.resolved.daysBeforeRelease,
                  version.releaseDate,
                  today,
                )
                return (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        DOT_BG[meta.badge],
                      )}
                    />
                    <span className="truncate text-fg">{t.resolved.name}</span>
                    <span
                      className={cn(
                        'ml-auto shrink-0 font-mono text-xs',
                        info.kind === 'flexible'
                          ? 'text-muted'
                          : URGENCY_TEXT[info.urgency.level],
                      )}
                    >
                      {info.kind === 'flexible'
                        ? 'elastyczny'
                        : info.urgency.overdue
                          ? 'po terminie'
                          : `${info.days} dni`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <div className="mt-3 font-mono text-xs text-muted">
        {instanceAgg.total === 0
          ? 'Brak podpiętych instancji'
          : `${instanceAgg.done}/${instanceAgg.total} instancji gotowych`}
      </div>
    </Link>
  )
}
