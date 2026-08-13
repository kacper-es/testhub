'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { assertVersionEditable } from '@/lib/versions/guard'

// Zarządzanie krokami danej wersji (ekran edycji wersji). TESTER/ADMIN, tylko na
// otwartej wersji (read-only na zamkniętej, reguła 12). Krok kopiowany z katalogu
// przy podpięciu (name/fieldType) — zmiany w katalogu nie ruszają wersji.

function revalidate(versionId: string): void {
  revalidatePath(`/versions/${versionId}/edit`)
  revalidatePath(`/versions/${versionId}`)
}

// Dołączenie kroków z katalogu. Jeśli krok był wcześniej odpięty (excludedAt) —
// przywróć (wartości wracają, reguła 18); jeśli aktywny — pomiń; inaczej utwórz kopię.
export async function addVersionColumns(formData: FormData): Promise<void> {
  await requireRole(['TESTER', 'ADMIN'])
  const versionId = String(formData.get('versionId') ?? '')
  const columnIds = formData.getAll('columnIds').map(String)
  if (!versionId || columnIds.length === 0) return

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { status: true },
  })
  if (!version) throw new Error('Nie znaleziono wersji')
  assertVersionEditable(version.status)

  const catalog = await prisma.column.findMany({
    where: { id: { in: columnIds }, isActive: true },
    select: { id: true, name: true, fieldType: true },
  })

  const existing = await prisma.versionColumn.findMany({
    where: { versionId, columnId: { in: columnIds } },
    select: { id: true, columnId: true, excludedAt: true },
  })
  const byColumnId = new Map(existing.map((e) => [e.columnId, e]))

  const agg = await prisma.versionColumn.aggregate({
    where: { versionId },
    _max: { sortOrder: true },
  })
  let order = agg._max.sortOrder ?? 0

  await prisma.$transaction(async (tx) => {
    for (const col of catalog) {
      const ex = byColumnId.get(col.id)
      if (ex) {
        if (ex.excludedAt !== null) {
          await tx.versionColumn.update({
            where: { id: ex.id },
            data: { excludedAt: null },
          })
        }
        continue // aktywny już istnieje
      }
      order += 10
      await tx.versionColumn.create({
        data: {
          versionId,
          columnId: col.id,
          name: col.name,
          fieldType: col.fieldType,
          sortOrder: order,
        },
      })
    }
  })

  revalidate(versionId)
}

// Usunięcie kroku z wersji = soft-hide (excludedAt). Wartości zostają (reguła 18).
export async function removeVersionColumn(formData: FormData): Promise<void> {
  await requireRole(['TESTER', 'ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const vc = await prisma.versionColumn.findUnique({
    where: { id },
    select: { versionId: true, excludedAt: true, version: { select: { status: true } } },
  })
  if (!vc) throw new Error('Nie znaleziono kroku')
  assertVersionEditable(vc.version.status)

  if (vc.excludedAt === null) {
    await prisma.versionColumn.update({
      where: { id },
      data: { excludedAt: new Date() },
    })
  }
  revalidate(vc.versionId)
}

// Przywrócenie ukrytego kroku (ten sam wiersz) — wartości zaznaczeń wracają (reguła 18).
export async function restoreVersionColumn(formData: FormData): Promise<void> {
  await requireRole(['TESTER', 'ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const vc = await prisma.versionColumn.findUnique({
    where: { id },
    select: { versionId: true, excludedAt: true, version: { select: { status: true } } },
  })
  if (!vc) throw new Error('Nie znaleziono kroku')
  assertVersionEditable(vc.version.status)

  if (vc.excludedAt !== null) {
    await prisma.versionColumn.update({
      where: { id },
      data: { excludedAt: null },
    })
  }
  revalidate(vc.versionId)
}
