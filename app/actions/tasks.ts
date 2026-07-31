'use server'

import { revalidatePath } from 'next/cache'
import type { TaskStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { assertVersionEditable } from '@/lib/versions/guard'
import { logChange } from '@/lib/versions/log-change'
import { ticketAggregateStatus } from '@/lib/versions/aggregates'
import { taskStatusSchema, ticketCountersSchema } from '@/lib/validation/task'

export type ActionResult = { error?: string }

// Ustawienie pól completedBy/At wg reguły 17: ustawienie DONE zapisuje,
// zdjęcie DONE czyści.
function completionData(
  from: TaskStatus,
  to: TaskStatus,
  userId: string,
): { completedById: string | null; completedAt: Date | null } | null {
  if (to === 'DONE' && from !== 'DONE') {
    return { completedById: userId, completedAt: new Date() }
  }
  if (to !== 'DONE' && from === 'DONE') {
    return { completedById: null, completedAt: null }
  }
  return null
}

// CHECKBOX — ręczna zmiana statusu. Log field 'status' (reguła 27).
export async function setCheckboxTaskStatus(
  versionTaskId: string,
  nextStatus: TaskStatus,
): Promise<ActionResult> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = taskStatusSchema.safeParse(nextStatus)
  if (!parsed.success) return { error: 'Nieprawidłowy status' }

  const task = await prisma.versionTask.findUnique({
    where: { id: versionTaskId },
    include: { version: { select: { status: true } }, taskTemplate: true },
  })
  if (!task) return { error: 'Nie znaleziono zadania' }
  assertVersionEditable(task.version.status)
  if (task.taskTemplate.taskType !== 'CHECKBOX') {
    return { error: 'To zadanie nie jest ręcznym checkboxem' }
  }
  if (task.status === parsed.data) return {}

  await prisma.$transaction(async (tx) => {
    await logChange(tx, {
      entityType: 'VersionTask',
      entityId: task.id,
      versionId: task.versionId,
      field: 'status',
      oldValue: task.status,
      newValue: parsed.data,
      userId: user.id,
    })
    await tx.versionTask.update({
      where: { id: task.id },
      data: {
        status: parsed.data,
        ...(completionData(task.status, parsed.data, user.id) ?? {}),
      },
    })
  })

  revalidatePath(`/versions/${task.versionId}`)
  return {}
}

// TICKET_AGGREGATE — ręczne liczniki, status wyliczany (reguła 15). Log zmienionych
// pól manualCounter* (reguła 27).
export async function setTicketCounters(
  versionTaskId: string,
  current: number,
  total: number,
): Promise<ActionResult> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = ticketCountersSchema.safeParse({ current, total })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const task = await prisma.versionTask.findUnique({
    where: { id: versionTaskId },
    include: { version: { select: { status: true } }, taskTemplate: true },
  })
  if (!task) return { error: 'Nie znaleziono zadania' }
  assertVersionEditable(task.version.status)
  if (task.taskTemplate.taskType !== 'TICKET_AGGREGATE') {
    return { error: 'To zadanie nie jest licznikiem ticketów' }
  }

  const nextCurrent = parsed.data.current
  const nextTotal = parsed.data.total
  if (
    task.manualCounterCurrent === nextCurrent &&
    task.manualCounterTotal === nextTotal
  ) {
    return {}
  }

  const nextStatus = ticketAggregateStatus(nextCurrent, nextTotal)

  await prisma.$transaction(async (tx) => {
    if (task.manualCounterCurrent !== nextCurrent) {
      await logChange(tx, {
        entityType: 'VersionTask',
        entityId: task.id,
        versionId: task.versionId,
        field: 'manualCounterCurrent',
        oldValue: String(task.manualCounterCurrent),
        newValue: String(nextCurrent),
        userId: user.id,
      })
    }
    if (task.manualCounterTotal !== nextTotal) {
      await logChange(tx, {
        entityType: 'VersionTask',
        entityId: task.id,
        versionId: task.versionId,
        field: 'manualCounterTotal',
        oldValue: String(task.manualCounterTotal),
        newValue: String(nextTotal),
        userId: user.id,
      })
    }
    await tx.versionTask.update({
      where: { id: task.id },
      data: {
        manualCounterCurrent: nextCurrent,
        manualCounterTotal: nextTotal,
        status: nextStatus,
        ...(completionData(task.status, nextStatus, user.id) ?? {}),
      },
    })
  })

  revalidatePath(`/versions/${task.versionId}`)
  return {}
}
