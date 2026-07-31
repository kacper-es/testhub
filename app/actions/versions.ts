'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma, type VersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { assertVersionEditable } from '@/lib/versions/guard'
import {
  cancelVersionSchema,
  createVersionSchema,
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
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { name, releaseDate } = parsed.data

  // Zbiór zadań/instancji zamrożony w chwili utworzenia (reguła 5): aktywne
  // szablony i aktywne instancje.
  const [templates, instances] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.instance.findMany({ where: { isActive: true }, select: { id: true } }),
  ])

  try {
    await prisma.$transaction(async (tx) => {
      const version = await tx.version.create({
        data: {
          name,
          releaseDate: parseDateOnly(releaseDate),
          createdById: user.id,
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
