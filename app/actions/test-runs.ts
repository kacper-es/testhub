'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { assertVersionEditable } from '@/lib/versions/guard'
import { logChange } from '@/lib/versions/log-change'
import { notesSchema } from '@/lib/validation/test-run'

export type ActionResult = { error?: string }

// Zaznaczenie jednego kroku (kolumny) dla jednego runu. Każdy krok to osobny
// wiersz InstanceRunValue (reguła 21) — dwie osoby klikające różne kroki w tym
// samym wierszu nie nadpisują się. Wartość tworzona leniwie (brak wiersza = false).
// Log w tej samej transakcji (reguła 28), kluczowany po id kroku wersji.
export async function setColumnValue(
  runId: string,
  versionColumnId: string,
  value: boolean,
): Promise<ActionResult> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const run = await prisma.instanceTestRun.findUnique({
    where: { id: runId },
    include: { version: { select: { status: true } } },
  })
  if (!run) return { error: 'Nie znaleziono instancji w wersji' }
  assertVersionEditable(run.version.status)

  const column = await prisma.versionColumn.findUnique({
    where: { id: versionColumnId },
    select: { versionId: true, excludedAt: true, fieldType: true },
  })
  if (
    !column ||
    column.versionId !== run.versionId ||
    column.excludedAt !== null
  ) {
    return { error: 'Nie znaleziono kroku w tej wersji' }
  }
  if (column.fieldType !== 'CHECKBOX') {
    return { error: 'Nieobsługiwany typ kroku' }
  }

  const where = {
    testRunId_versionColumnId: { testRunId: runId, versionColumnId },
  }
  const existing = await prisma.instanceRunValue.findUnique({
    where,
    select: { boolValue: true },
  })
  const oldValue = existing?.boolValue ?? false
  if (oldValue === value) return {}

  await prisma.$transaction(async (tx) => {
    await logChange(tx, {
      entityType: 'InstanceTestRun',
      entityId: run.id,
      versionId: run.versionId,
      field: versionColumnId,
      oldValue: String(oldValue),
      newValue: String(value),
      userId: user.id,
    })
    await tx.instanceRunValue.upsert({
      where,
      create: {
        testRunId: runId,
        versionColumnId,
        boolValue: value,
        updatedById: user.id,
      },
      update: { boolValue: value, updatedById: user.id },
    })
  })

  revalidatePath(`/versions/${run.versionId}`)
  return {}
}

// Notatki — zapis z debounce po stronie klienta; tu walidacja + log (reguła 27).
export async function setNotes(
  runId: string,
  notes: string,
): Promise<ActionResult> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = notesSchema.safeParse(notes)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowa notatka' }
  }

  const run = await prisma.instanceTestRun.findUnique({
    where: { id: runId },
    include: { version: { select: { status: true } } },
  })
  if (!run) return { error: 'Nie znaleziono instancji w wersji' }
  assertVersionEditable(run.version.status)

  const next = parsed.data.trim() === '' ? null : parsed.data
  if ((run.notes ?? null) === next) return {}

  await prisma.$transaction(async (tx) => {
    await logChange(tx, {
      entityType: 'InstanceTestRun',
      entityId: run.id,
      versionId: run.versionId,
      field: 'notes',
      oldValue: run.notes,
      newValue: next,
      userId: user.id,
    })
    await tx.instanceTestRun.update({
      where: { id: run.id },
      data: { notes: next, updatedById: user.id },
    })
  })

  revalidatePath(`/versions/${run.versionId}`)
  return {}
}

// Odpięcie instancji = excludedAt = now(). Nigdy delete (reguła 18). Notatki i
// flagi zostają. Zmiana excludedAt NIE idzie do ChangeLog (reguła 27 nie obejmuje).
export async function unpinInstanceRun(formData: FormData): Promise<void> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const runId = String(formData.get('runId') ?? '')

  const run = await prisma.instanceTestRun.findUnique({
    where: { id: runId },
    include: { version: { select: { status: true } } },
  })
  if (!run) throw new Error('Nie znaleziono instancji w wersji')
  assertVersionEditable(run.version.status)
  if (run.excludedAt !== null) return

  await prisma.instanceTestRun.update({
    where: { id: run.id },
    data: { excludedAt: new Date(), updatedById: user.id },
  })
  revalidatePath(`/versions/${run.versionId}`)
}

// Podepnij instancję (reguła 20): jeśli istnieje odpięty run — przywróć
// (excludedAt = null, dane wracają, reguła 18); jeśli nie ma runu — utwórz.
export async function attachInstance(formData: FormData): Promise<void> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const versionId = String(formData.get('versionId') ?? '')
  const instanceId = String(formData.get('instanceId') ?? '')
  if (!versionId || !instanceId) throw new Error('Nieprawidłowe dane')

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { status: true },
  })
  if (!version) throw new Error('Nie znaleziono wersji')
  assertVersionEditable(version.status)

  const existing = await prisma.instanceTestRun.findUnique({
    where: { versionId_instanceId: { versionId, instanceId } },
  })

  if (existing) {
    if (existing.excludedAt !== null) {
      await prisma.instanceTestRun.update({
        where: { id: existing.id },
        data: { excludedAt: null, updatedById: user.id },
      })
    }
  } else {
    await prisma.instanceTestRun.create({
      data: { versionId, instanceId, updatedById: user.id },
    })
  }

  revalidatePath(`/versions/${versionId}`)
}
