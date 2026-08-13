'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { columnSchema, columnTemplateSchema } from '@/lib/validation/column'

export type ColumnFormState = { error?: string }

const STEPS_PATH = '/admin/columns'
const FLOWS_PATH = '/admin/columns?tab=flows'

// Konfiguracja kroków i szablonów — tylko ADMIN. Zero hard delete: kroki/szablony
// dezaktywuje się przez isActive. Wersje kopiują kroki przy podpięciu (krok B),
// więc te zmiany nie ruszają istniejących wersji.

// ── Katalog kroków ────────────────────────────────────────────────────────

export async function createColumn(
  _prev: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  await requireRole(['ADMIN'])
  const parsed = columnSchema.safeParse({
    name: formData.get('name'),
    fieldType: formData.get('fieldType'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  await prisma.column.create({ data: parsed.data })
  redirect(STEPS_PATH)
}

export async function updateColumn(
  _prev: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora kroku' }

  const parsed = columnSchema.safeParse({
    name: formData.get('name'),
    fieldType: formData.get('fieldType'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  await prisma.column.update({ where: { id }, data: parsed.data })
  redirect(STEPS_PATH)
}

export async function setColumnActive(formData: FormData): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!id) throw new Error('Brak identyfikatora kroku')

  await prisma.column.update({ where: { id }, data: { isActive: active } })
  revalidatePath(STEPS_PATH)
}

// ── Szablony (flow) ───────────────────────────────────────────────────────

// Kroki szablonu składane od nowa z zaznaczonych id (add/remove to konfiguracja,
// nie audytowane dane domenowe). Kolejność = kolejność przesłanej listy.
async function syncItems(
  tx: Prisma.TransactionClient,
  templateId: string,
  columnIds: string[],
): Promise<void> {
  await tx.columnTemplateItem.deleteMany({ where: { templateId } })
  if (columnIds.length > 0) {
    await tx.columnTemplateItem.createMany({
      data: columnIds.map((columnId, i) => ({
        templateId,
        columnId,
        sortOrder: i,
      })),
    })
  }
}

export async function createColumnTemplate(
  _prev: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  await requireRole(['ADMIN'])
  const parsed = columnTemplateSchema.safeParse({
    name: formData.get('name'),
    isDefault: formData.get('isDefault') === 'on',
    sortOrder: formData.get('sortOrder'),
    columnIds: formData.getAll('columnIds').map(String),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { name, isDefault, sortOrder, columnIds } = parsed.data

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.columnTemplate.updateMany({ data: { isDefault: false } })
    }
    const template = await tx.columnTemplate.create({
      data: { name, isDefault, sortOrder },
    })
    await syncItems(tx, template.id, columnIds)
  })

  redirect(FLOWS_PATH)
}

export async function updateColumnTemplate(
  _prev: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora szablonu' }

  const parsed = columnTemplateSchema.safeParse({
    name: formData.get('name'),
    isDefault: formData.get('isDefault') === 'on',
    sortOrder: formData.get('sortOrder'),
    columnIds: formData.getAll('columnIds').map(String),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { name, isDefault, sortOrder, columnIds } = parsed.data

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.columnTemplate.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      })
    }
    await tx.columnTemplate.update({
      where: { id },
      data: { name, isDefault, sortOrder },
    })
    await syncItems(tx, id, columnIds)
  })

  redirect(FLOWS_PATH)
}

export async function setColumnTemplateActive(
  formData: FormData,
): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!id) throw new Error('Brak identyfikatora szablonu')

  await prisma.columnTemplate.update({
    where: { id },
    data: { isActive: active },
  })
  revalidatePath(FLOWS_PATH)
}

export async function setDefaultColumnTemplate(
  formData: FormData,
): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('Brak identyfikatora szablonu')

  await prisma.$transaction(async (tx) => {
    await tx.columnTemplate.updateMany({ data: { isDefault: false } })
    await tx.columnTemplate.update({ where: { id }, data: { isDefault: true } })
  })
  revalidatePath(FLOWS_PATH)
}
