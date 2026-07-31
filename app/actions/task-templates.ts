'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import {
  taskTypeSchema,
  templateBaseSchema,
} from '@/lib/validation/task-template'

export type TemplateFormState = { error?: string }

// Zarządzanie szablonami — tylko ADMIN (sekcja 5). Edycja pól działa na żywo we
// wszystkich wersjach IN_PROGRESS (reguła 4); wersje zamknięte czytają snapshoty.
export async function createTaskTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireRole(['ADMIN'])

  const type = taskTypeSchema.safeParse(formData.get('taskType'))
  if (!type.success) return { error: 'Wybierz typ zadania' }

  const parsed = templateBaseSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    deadlineType: formData.get('deadlineType'),
    daysBeforeRelease: formData.get('daysBeforeRelease'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const { deadlineType, daysBeforeRelease } = parsed.data
  if (deadlineType === 'DAYS_BEFORE_RELEASE' && daysBeforeRelease == null) {
    return { error: 'Podaj liczbę dni przed wydaniem' }
  }

  await prisma.taskTemplate.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      taskType: type.data,
      deadlineType,
      daysBeforeRelease:
        deadlineType === 'DAYS_BEFORE_RELEASE' ? daysBeforeRelease : null,
      sortOrder: parsed.data.sortOrder,
    },
  })

  redirect('/admin/templates')
}

// taskType jest niezmienny (reguła 7) — nie przyjmujemy go w update.
export async function updateTaskTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora szablonu' }

  const parsed = templateBaseSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    deadlineType: formData.get('deadlineType'),
    daysBeforeRelease: formData.get('daysBeforeRelease'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const { deadlineType, daysBeforeRelease } = parsed.data
  if (deadlineType === 'DAYS_BEFORE_RELEASE' && daysBeforeRelease == null) {
    return { error: 'Podaj liczbę dni przed wydaniem' }
  }

  await prisma.taskTemplate.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      deadlineType,
      daysBeforeRelease:
        deadlineType === 'DAYS_BEFORE_RELEASE' ? daysBeforeRelease : null,
      sortOrder: parsed.data.sortOrder,
    },
  })

  redirect('/admin/templates')
}

// Dezaktywacja: nie pojawia się w nowych wersjach, istniejące VersionTask zostają
// (reguła 8). Nigdy delete.
export async function setTaskTemplateActive(formData: FormData): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!id) throw new Error('Brak identyfikatora szablonu')

  await prisma.taskTemplate.update({
    where: { id },
    data: { isActive: active },
  })
  revalidatePath('/admin/templates')
}
