'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { hashPassword } from '@/lib/auth/password'
import {
  createUserSchema,
  resetPasswordSchema,
  roleSchema,
} from '@/lib/validation/user'

export type UserFormState = { error?: string }

// Zarządzanie kontami — tylko ADMIN (sekcja 5). Brak rejestracji i resetu mailowego.
export async function createUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireRole(['ADMIN'])

  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash,
        mustChangePassword: true, // hasło tymczasowe (sekcja 6)
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Konto z tym adresem email już istnieje' }
    }
    throw e
  }

  redirect('/admin/users')
}

// Reset hasła: nowe hasło tymczasowe + usunięcie wszystkich sesji użytkownika (sekcja 6).
export async function resetUserPassword(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Brak identyfikatora konta' }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ])

  redirect('/admin/users')
}

// Dezaktywacja/reaktywacja. isActive = false usuwa wszystkie sesje (sekcja 6).
// Zabezpieczenie: ADMIN nie może dezaktywować własnego konta (blokada wykluczenia).
export async function setUserActive(formData: FormData): Promise<void> {
  const admin = await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!id) throw new Error('Brak identyfikatora konta')
  if (id === admin.id && !active) {
    throw new Error('Nie możesz dezaktywować własnego konta')
  }

  if (active) {
    await prisma.user.update({ where: { id }, data: { isActive: true } })
  } else {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { isActive: false } }),
      prisma.session.deleteMany({ where: { userId: id } }),
    ])
  }
  revalidatePath('/admin/users')
}

// Zmiana roli. Zabezpieczenie: ADMIN nie może zmienić własnej roli (blokada wykluczenia).
export async function setUserRole(formData: FormData): Promise<void> {
  const admin = await requireRole(['ADMIN'])
  const id = String(formData.get('id') ?? '')
  const role = roleSchema.safeParse(formData.get('role'))
  if (!id) throw new Error('Brak identyfikatora konta')
  if (!role.success) throw new Error('Nieprawidłowa rola')
  if (id === admin.id) {
    throw new Error('Nie możesz zmienić własnej roli')
  }

  await prisma.user.update({ where: { id }, data: { role: role.data } })
  revalidatePath('/admin/users')
}
