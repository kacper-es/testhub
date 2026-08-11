'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { instanceSchema } from '@/lib/validation/instance'

export type InstanceFormState = { error?: string }

// Katalog instancji to konfiguracja administracyjna (ADMIN) — ustawiana na starcie,
// edytowana rzadko. Zero delete — dezaktywacja przez isActive (reguła integralności).
// Nowa/edytowana instancja nie dopina się sama do trwających wersji (reguła 20 — to
// robi „Podepnij instancję" w widoku wersji).
export async function createInstance(
  _prev: InstanceFormState,
  formData: FormData,
): Promise<InstanceFormState> {
  await requireRole(['ADMIN'])
  const parsed = instanceSchema.safeParse({
    name: formData.get('name'),
    clientName: formData.get('clientName'),
    keyFunctionalities: formData.get('keyFunctionalities'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  await prisma.instance.create({ data: parsed.data })
  redirect('/admin/instances')
}

export async function updateInstance(
  _prev: InstanceFormState,
  formData: FormData,
): Promise<InstanceFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora instancji' }

  const parsed = instanceSchema.safeParse({
    name: formData.get('name'),
    clientName: formData.get('clientName'),
    keyFunctionalities: formData.get('keyFunctionalities'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  await prisma.instance.update({ where: { id }, data: parsed.data })
  redirect('/admin/instances')
}

// Dezaktywacja / reaktywacja — nigdy delete (reguła integralności).
export async function setInstanceActive(formData: FormData): Promise<void> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!id) throw new Error('Brak identyfikatora instancji')

  await prisma.instance.update({ where: { id }, data: { isActive: active } })
  revalidatePath('/admin/instances')
}
