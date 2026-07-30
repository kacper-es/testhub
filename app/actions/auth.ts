'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import {
  SESSION_COOKIE,
  createSession,
  destroyCurrentSession,
  getSessionUser,
} from '@/lib/auth/session'
import {
  isRateLimited,
  recordFailedAttempt,
  resetAttempts,
} from '@/lib/auth/rate-limit'
import { changePasswordSchema, loginSchema } from '@/lib/validation/auth'

export type LoginState = { error?: string }
export type ChangePasswordState = { error?: string }

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const { email, password } = parsed.data

  if (isRateLimited(email)) {
    return { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' }
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  // Neutralny komunikat — nie ujawniamy, czy konto istnieje ani czy jest
  // nieaktywne (sekcja 6).
  const ok =
    !!user &&
    user.isActive &&
    (await verifyPassword(password, user.passwordHash))

  if (!ok) {
    recordFailedAttempt(email)
    return { error: 'Nieprawidłowy email lub hasło' }
  }

  resetAttempts(email)
  await createSession(user.id)
  redirect(user.mustChangePassword ? '/change-password' : '/')
}

export async function logout(): Promise<void> {
  await destroyCurrentSession()
  redirect('/login')
}

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const { currentPassword, newPassword } = parsed.data

  const ok = await verifyPassword(currentPassword, user.passwordHash)
  if (!ok) {
    return { error: 'Obecne hasło jest nieprawidłowe' }
  }

  const newHash = await hashPassword(newPassword)

  // Zmiana hasła usuwa wszystkie sesje użytkownika (sekcja 6) — w tej samej
  // transakcji co zapis nowego hasła.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ])

  const jar = await cookies()
  jar.delete(SESSION_COOKIE)

  redirect('/login?changed=1')
}
