'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import {
  applicationBaseSchema,
  isAllowedIconType,
  MAX_ICON_BYTES,
} from '@/lib/validation/application'

export type ApplicationFormState = { error?: string }

// Zarządzanie aplikacjami — tylko ADMIN. CRUD aplikacji nie idzie do ChangeLog
// (spójne z szablonami/instancjami — reguła 27). Zero hard delete: isActive.
export async function createApplication(
  _prev: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  await requireRole(['ADMIN'])

  const parsed = applicationBaseSchema.safeParse({
    name: formData.get('name'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  try {
    await prisma.application.create({
      data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: `Aplikacja ${parsed.data.name} już istnieje` }
    }
    throw e
  }

  redirect('/admin/applications')
}

export async function updateApplication(
  _prev: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora aplikacji' }

  const parsed = applicationBaseSchema.safeParse({
    name: formData.get('name'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  try {
    await prisma.application.update({
      where: { id },
      data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: `Aplikacja ${parsed.data.name} już istnieje` }
    }
    throw e
  }

  redirect('/admin/applications')
}

// Dezaktywacja: aplikacja znika z selektorów tworzenia i z filtrów, ale
// istniejące wersje zachowują ikonę i nazwę (nie zrywamy powiązania).
export async function setApplicationActive(formData: FormData): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!id) throw new Error('Brak identyfikatora aplikacji')

  await prisma.application.update({ where: { id }, data: { isActive: active } })
  revalidatePath('/admin/applications')
}

// Upload ikony: walidacja MIME + rozmiaru, zapis surowych bajtów (bez sharpa).
export async function uploadApplicationIcon(
  _prev: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora aplikacji' }

  const file = formData.get('icon')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Wybierz plik ikony' }
  }
  if (!isAllowedIconType(file.type)) {
    return { error: 'Dozwolone formaty: PNG, WebP, JPEG' }
  }
  if (file.size > MAX_ICON_BYTES) {
    return { error: 'Ikona może mieć maksymalnie 100 KB' }
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  await prisma.application.update({
    where: { id },
    data: {
      iconData: bytes,
      iconType: file.type,
      iconUpdatedAt: new Date(),
    },
  })

  revalidatePath(`/admin/applications/${id}/edit`)
  revalidatePath('/admin/applications')
  return {}
}

// Usunięcie ikony czyści atrybut (nie kasuje rekordu aplikacji).
export async function removeApplicationIcon(formData: FormData): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('Brak identyfikatora aplikacji')

  await prisma.application.update({
    where: { id },
    data: { iconData: null, iconType: null, iconUpdatedAt: null },
  })
  revalidatePath(`/admin/applications/${id}/edit`)
  revalidatePath('/admin/applications')
}
