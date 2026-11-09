'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma, type VersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { assertVersionEditable } from '@/lib/versions/guard'
import { logChange, type LogChangeInput } from '@/lib/versions/log-change'
import { toDateOnly } from '@/lib/versions/deadline'
import {
  addVersionTasksSchema,
  cancelVersionSchema,
  createVersionSchema,
  deleteVersionSchema,
  unpinVersionTaskSchema,
  updateVersionSchema,
} from '@/lib/validation/version'

export type CreateVersionState = { error?: string }

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export async function createVersion(
  _prev: CreateVersionState,
  formData: FormData,
): Promise<CreateVersionState> {
  const user = await requireRole(['TESTER', 'ADMIN'])

  const parsed = createVersionSchema.safeParse({
    name: formData.get('name'),
    releaseDate: formData.get('releaseDate'),
    applicationId: formData.get('applicationId') ?? '',
    columnTemplateId: formData.get('columnTemplateId') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { name, releaseDate, applicationId, columnTemplateId } = parsed.data

  // Aplikacja opcjonalna — jeśli podana, musi istnieć i być aktywna.
  if (applicationId) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, isActive: true },
      select: { id: true },
    })
    if (!app) return { error: 'Wybrana aplikacja jest niedostępna' }
  }

  // Zbiór zadań/instancji zamrożony w chwili utworzenia (reguła 5): aktywne
  // szablony i aktywne instancje.
  const [templates, instances] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.instance.findMany({ where: { isActive: true }, select: { id: true } }),
  ])

  // Kroki podpinane z wybranego szablonu (flow) — kopia przy podpięciu, tylko
  // aktywne kroki katalogu. Kolejność wg pozycji w szablonie.
  const flowColumns = columnTemplateId
    ? await prisma.columnTemplateItem.findMany({
        where: { templateId: columnTemplateId, column: { isActive: true } },
        include: { column: { select: { id: true, name: true, fieldType: true } } },
        orderBy: { sortOrder: 'asc' },
      })
    : []

  try {
    await prisma.$transaction(async (tx) => {
      const version = await tx.version.create({
        data: {
          name,
          releaseDate: parseDateOnly(releaseDate),
          createdById: user.id,
          applicationId,
        },
      })
      if (templates.length > 0) {
        await tx.versionTask.createMany({
          data: templates.map((t) => ({
            versionId: version.id,
            taskTemplateId: t.id,
          })),
        })
      }
      if (instances.length > 0) {
        await tx.instanceTestRun.createMany({
          data: instances.map((i) => ({
            versionId: version.id,
            instanceId: i.id,
          })),
        })
      }
      if (flowColumns.length > 0) {
        await tx.versionColumn.createMany({
          data: flowColumns.map((it, i) => ({
            versionId: version.id,
            columnId: it.column.id,
            name: it.column.name,
            fieldType: it.column.fieldType,
            sortOrder: (i + 1) * 10,
          })),
        })
      }
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return { error: `Wersja ${name} już istnieje` }
    }
    throw e
  }

  redirect('/versions')
}

// Wspólne zamknięcie wersji: zapis wszystkich *Snapshot + statusChanged*
// w jednej transakcji (reguła 10). Nie eksportowane jako akcja.
async function closeVersion(
  versionId: string,
  status: Extract<VersionStatus, 'RELEASED' | 'CANCELLED'>,
  reason: string | null,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const version = await tx.version.findUnique({
      where: { id: versionId },
      include: { tasks: { include: { taskTemplate: true } } },
    })
    if (!version) throw new Error('Nie znaleziono wersji')
    assertVersionEditable(version.status)

    for (const task of version.tasks) {
      const t = task.taskTemplate
      await tx.versionTask.update({
        where: { id: task.id },
        data: {
          nameSnapshot: t.name,
          descriptionSnapshot: t.description,
          taskTypeSnapshot: t.taskType,
          deadlineTypeSnapshot: t.deadlineType,
          daysBeforeReleaseSnapshot: t.daysBeforeRelease,
          sortOrderSnapshot: t.sortOrder,
        },
      })
    }

    await tx.version.update({
      where: { id: versionId },
      data: {
        status,
        cancelReason: reason,
        statusChangedById: userId,
        statusChangedAt: new Date(),
      },
    })
  })
}

export async function releaseVersion(formData: FormData): Promise<void> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const versionId = String(formData.get('versionId') ?? '')
  await closeVersion(versionId, 'RELEASED', null, user.id)
  revalidatePath('/versions')
}

export async function cancelVersion(formData: FormData): Promise<void> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = cancelVersionSchema.safeParse({
    versionId: formData.get('versionId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane')
  }
  await closeVersion(
    parsed.data.versionId,
    'CANCELLED',
    parsed.data.reason,
    user.id,
  )
  revalidatePath('/versions')
}

// Ponowne otwarcie — tylko ADMIN. Czyści snapshoty i zapisuje statusChanged* (reguła 13).
export async function reopenVersion(formData: FormData): Promise<void> {
  const user = await requireRole(['ADMIN'])
  const versionId = String(formData.get('versionId') ?? '')

  await prisma.$transaction(async (tx) => {
    const version = await tx.version.findUnique({
      where: { id: versionId },
      select: { status: true },
    })
    if (!version) throw new Error('Nie znaleziono wersji')
    if (version.status === 'IN_PROGRESS') return

    await tx.versionTask.updateMany({
      where: { versionId },
      data: {
        nameSnapshot: null,
        descriptionSnapshot: null,
        taskTypeSnapshot: null,
        deadlineTypeSnapshot: null,
        daysBeforeReleaseSnapshot: null,
        sortOrderSnapshot: null,
      },
    })
    await tx.version.update({
      where: { id: versionId },
      data: {
        status: 'IN_PROGRESS',
        cancelReason: null,
        statusChangedById: user.id,
        statusChangedAt: new Date(),
      },
    })
  })

  revalidatePath('/versions')
}

export type UpdateVersionState = { error?: string }

// Edycja wersji (nazwa, data wydania, aplikacja) — tylko na otwartej wersji
// (read-only na zamkniętej, reguła 12). Każda zmieniona wartość idzie do ChangeLog
// (stara→nowa) w tej samej transakcji co mutacja (reguły 27/28, rozszerzone o pola
// Version na wniosek użytkownika). Zmiany statusu wersji nadal poza ChangeLog (reguła 30).
export async function updateVersion(
  _prev: UpdateVersionState,
  formData: FormData,
): Promise<UpdateVersionState> {
  const user = await requireRole(['TESTER', 'ADMIN'])

  const parsed = updateVersionSchema.safeParse({
    versionId: formData.get('versionId'),
    name: formData.get('name'),
    releaseDate: formData.get('releaseDate'),
    applicationId: formData.get('applicationId') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { versionId, name, releaseDate, applicationId } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      const version = await tx.version.findUnique({
        where: { id: versionId },
        select: {
          status: true,
          name: true,
          releaseDate: true,
          applicationId: true,
          jiraVersionId: true,
          jiraVersionName: true,
          application: { select: { name: true } },
        },
      })
      if (!version) throw new Error('Nie znaleziono wersji')
      assertVersionEditable(version.status)

      const data: Prisma.VersionUncheckedUpdateInput = {}
      const logs: LogChangeInput[] = []
      const base = {
        entityType: 'Version' as const,
        entityId: versionId,
        versionId,
        userId: user.id,
      }

      if (name !== version.name) {
        data.name = name
        logs.push({ ...base, field: 'name', oldValue: version.name, newValue: name })
      }

      const oldDate = toDateOnly(version.releaseDate)
      if (releaseDate !== oldDate) {
        data.releaseDate = parseDateOnly(releaseDate)
        logs.push({ ...base, field: 'releaseDate', oldValue: oldDate, newValue: releaseDate })
      }

      if (applicationId !== version.applicationId) {
        // Zmiana aplikacji — jeśli podana, musi istnieć i być aktywna.
        let newName: string | null = null
        if (applicationId) {
          const app = await tx.application.findFirst({
            where: { id: applicationId, isActive: true },
            select: { name: true },
          })
          if (!app) throw new Error('Wybrana aplikacja jest niedostępna')
          newName = app.name
        }
        data.applicationId = applicationId
        logs.push({
          ...base,
          field: 'application',
          oldValue: version.application?.name ?? null,
          newValue: newName,
        })

        // Wersja Jira należy do projektu poprzedniej aplikacji — odpinamy (J-2).
        if (version.jiraVersionId !== null) {
          data.jiraVersionId = null
          data.jiraVersionName = null
          logs.push({
            ...base,
            field: 'jiraVersion',
            oldValue: version.jiraVersionName,
            newValue: null,
          })
        }
      }

      if (logs.length === 0) return // nic się nie zmieniło

      await tx.version.update({ where: { id: versionId }, data })
      for (const entry of logs) await logChange(tx, entry)
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return { error: `Wersja ${name} już istnieje` }
    }
    throw e
  }

  revalidatePath(`/versions/${versionId}`)
  revalidatePath('/versions')
  revalidatePath('/')
  revalidatePath('/archive')
  redirect(`/versions/${versionId}`)
}

// "Add task from template" (rule 6): the task set is frozen at creation (rule 5);
// this is the escape hatch for templates created later. Open versions only.
// templateId given: restores the task if it was unpinned (V-3, state comes back),
// otherwise creates it from an active template.
// Empty templateId = every active template never present in the version
// (unpinned tasks are restored one by one, on purpose).
export async function addVersionTasks(formData: FormData): Promise<void> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = addVersionTasksSchema.safeParse({
    versionId: formData.get('versionId'),
    templateId: formData.get('templateId') ?? '',
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane')
  }
  const { versionId, templateId } = parsed.data

  await prisma.$transaction(async (tx) => {
    const version = await tx.version.findUnique({
      where: { id: versionId },
      select: { status: true },
    })
    if (!version) throw new Error('Nie znaleziono wersji')
    assertVersionEditable(version.status)

    if (templateId) {
      const existing = await tx.versionTask.findUnique({
        where: { versionId_taskTemplateId: { versionId, taskTemplateId: templateId } },
        select: { id: true, excludedAt: true },
      })
      if (existing) {
        if (existing.excludedAt === null) throw new Error('Zadanie już jest w tej wersji')
        await logChange(tx, {
          entityType: 'VersionTask',
          entityId: existing.id,
          versionId,
          field: 'pinned',
          oldValue: 'false',
          newValue: 'true',
          userId: user.id,
        })
        await tx.versionTask.update({
          where: { id: existing.id },
          data: { excludedAt: null },
        })
        return
      }
    }

    const missing = await tx.taskTemplate.findMany({
      where: {
        isActive: true,
        ...(templateId ? { id: templateId } : {}),
        versionTasks: { none: { versionId } },
      },
      select: { id: true },
    })
    if (templateId && missing.length === 0) {
      throw new Error('Szablon jest nieaktywny albo już jest w tej wersji')
    }
    if (missing.length === 0) return

    await tx.versionTask.createMany({
      data: missing.map((t) => ({ versionId, taskTemplateId: t.id })),
      skipDuplicates: true,
    })
  })

  revalidatePath(`/versions/${versionId}`)
  revalidatePath(`/versions/${versionId}/edit`)
  revalidatePath('/')
}

// Unpin a task from the version (V-3) — soft, via excludedAt (zero hard delete).
// Status and counters stay and come back on restore. Open versions only.
export async function unpinVersionTask(formData: FormData): Promise<void> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = unpinVersionTaskSchema.safeParse({ taskId: formData.get('taskId') })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane')
  }

  const versionId = await prisma.$transaction(async (tx) => {
    const task = await tx.versionTask.findUnique({
      where: { id: parsed.data.taskId },
      select: { id: true, versionId: true, excludedAt: true, version: { select: { status: true } } },
    })
    if (!task) throw new Error('Nie znaleziono zadania')
    assertVersionEditable(task.version.status)
    if (task.excludedAt !== null) return task.versionId

    await logChange(tx, {
      entityType: 'VersionTask',
      entityId: task.id,
      versionId: task.versionId,
      field: 'pinned',
      oldValue: 'true',
      newValue: 'false',
      userId: user.id,
    })
    await tx.versionTask.update({
      where: { id: task.id },
      data: { excludedAt: new Date() },
    })
    return task.versionId
  })

  revalidatePath(`/versions/${versionId}`)
  revalidatePath(`/versions/${versionId}/edit`)
  revalidatePath('/versions')
  revalidatePath('/')
}

export type DeleteVersionState = { error?: string }

// Permanent delete — the only hard delete besides Session (CLAUDE.md exception).
// ADMIN only, confirmed by typing the version name. Tasks, instance runs (with
// notes), comments and version columns go with it (onDelete: Cascade). The
// ChangeLog entry is written first in the same transaction; ChangeLog has no FK
// to Version, so older entries of this version stay.
export async function deleteVersion(
  _prev: DeleteVersionState,
  formData: FormData,
): Promise<DeleteVersionState> {
  const user = await requireRole(['ADMIN'])
  const parsed = deleteVersionSchema.safeParse({
    versionId: formData.get('versionId'),
    confirmName: formData.get('confirmName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { versionId, confirmName } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    const version = await tx.version.findUnique({
      where: { id: versionId },
      select: { name: true },
    })
    if (!version) return { error: 'Nie znaleziono wersji' }
    if (confirmName !== version.name) {
      return { error: 'Nazwa nie zgadza się z nazwą wersji' }
    }

    await logChange(tx, {
      entityType: 'Version',
      entityId: versionId,
      versionId: null,
      field: 'deleted',
      oldValue: version.name,
      newValue: null,
      userId: user.id,
    })
    await tx.version.delete({ where: { id: versionId } })
    return null
  })
  if (result) return result

  revalidatePath('/versions')
  revalidatePath('/')
  revalidatePath('/archive')
  revalidatePath('/admin/changelog')
  redirect('/versions')
}
