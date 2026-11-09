import type { Prisma, TaskStatus } from '@prisma/client'
import { resolveTask, type ResolvedTask } from '@/lib/versions/resolve-task'
import {
  daysRemaining,
  resolveDeadline,
  toDateOnly,
  urgency,
  type DeadlineInfo,
  type Urgency,
} from '@/lib/versions/deadline'
import { instanceAggregateStatus, type InstanceAggregate } from '@/lib/versions/aggregates'
import { ticketTaskView, type JiraCounts } from '@/lib/versions/ticket-source'
import { buildTimeline, type Timeline } from '@/lib/versions/overview'

// UI-2c: one summary of an open version for the dashboard (cards + KPI strip).
// Same rules as the version view: resolveTask, aggregates, server-side dates.
export type DashboardVersion = Prisma.VersionGetPayload<{
  include: {
    tasks: { include: { taskTemplate: true } }
    testRuns: { include: { values: true } }
    columns: true
    application: {
      select: { id: true; name: true; iconType: true; iconUpdatedAt: true }
    }
  }
}>

export type SummaryTask = {
  id: string
  resolved: ResolvedTask
  status: TaskStatus
  deadline: DeadlineInfo
}

export type VersionSummary = {
  tasks: SummaryTask[]
  tasksDone: number
  overdueOpen: number // open tasks past their deadline
  instanceAgg: InstanceAggregate
  stepsDone: number
  stepsTotal: number
  daysLeft: number
  urgency: Urgency
  timeline: Timeline
  jira: JiraCounts | null // null = no synced Jira data
}

export function summarizeVersion(
  version: DashboardVersion,
  today: string,
  jiraCounts: JiraCounts | null,
  jiraConfigured: boolean,
): VersionSummary {
  const checkboxColumnIds = new Set(
    version.columns
      .filter((c) => c.excludedAt === null && c.fieldType === 'CHECKBOX')
      .map((c) => c.id),
  )
  const activeRuns = version.testRuns.filter((r) => r.excludedAt === null)
  const trueCounts = version.testRuns.map((run) => ({
    excludedAt: run.excludedAt,
    trueCount: run.values.filter((v) => checkboxColumnIds.has(v.versionColumnId) && v.boolValue)
      .length,
  }))
  const instanceAgg = instanceAggregateStatus(trueCounts, checkboxColumnIds.size)
  const stepsDone = trueCounts
    .filter((r) => r.excludedAt === null)
    .reduce((n, r) => n + r.trueCount, 0)

  const tasks: SummaryTask[] = version.tasks
    .map((task) => {
      const resolved = resolveTask(task, task.taskTemplate, version.status)
      const status: TaskStatus =
        resolved.taskType === 'CHECKBOX'
          ? task.status
          : resolved.taskType === 'TICKET_AGGREGATE'
            ? ticketTaskView({
                versionStatus: version.status,
                jiraMapped: version.jiraVersionId !== null,
                jiraSynced: version.jiraSyncedAt !== null,
                jiraConfigured,
                manual: { current: task.manualCounterCurrent, total: task.manualCounterTotal },
                jira: jiraCounts,
              }).status
            : instanceAgg.status
      const deadline = resolveDeadline(
        resolved.deadlineType,
        resolved.daysBeforeRelease,
        version.releaseDate,
        today,
      )
      return { id: task.id, resolved, status, deadline }
    })
    .sort((a, b) => a.resolved.sortOrder - b.resolved.sortOrder)

  const releaseDay = toDateOnly(version.releaseDate)
  const daysLeft = daysRemaining(releaseDay, today)

  const timeline = buildTimeline(
    today,
    releaseDay,
    tasks.flatMap((t) =>
      t.deadline.kind === 'deadline'
        ? [
            {
              id: t.id,
              name: t.resolved.name,
              deadline: t.deadline.deadline,
              done: t.status === 'DONE',
              level: t.deadline.urgency.level,
              overdue: t.deadline.urgency.overdue,
            },
          ]
        : [],
    ),
  )

  return {
    tasks,
    tasksDone: tasks.filter((t) => t.status === 'DONE').length,
    overdueOpen: tasks.filter(
      (t) => t.status !== 'DONE' && t.deadline.kind === 'deadline' && t.deadline.urgency.overdue,
    ).length,
    instanceAgg,
    stepsDone,
    stepsTotal: activeRuns.length * checkboxColumnIds.size,
    daysLeft,
    urgency: urgency(daysLeft),
    timeline,
    jira: version.jiraVersionId && version.jiraSyncedAt ? jiraCounts ?? { done: 0, total: 0 } : null,
  }
}
