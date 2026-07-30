import { redirect } from 'next/navigation'
import type { Role, User } from '@prisma/client'
import { getSessionUser } from '@/lib/auth/session'
import { assertRole } from '@/lib/auth/roles'

export { AuthorizationError, assertRole } from '@/lib/auth/roles'

// Do server actions i route handlerów. Rzuca AuthorizationError, gdy brak
// uprawnień → mutacja zostaje odrzucona po stronie serwera (sekcja 5).
export async function requireRole(roles: Role[]): Promise<User> {
  const user = await getSessionUser()
  assertRole(user, roles)
  return user
}

// Do stron/layoutów wymagających zalogowania (przekierowuje zamiast rzucać).
export async function requireUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

// Do stron/layoutów wymagających konkretnej roli (np. przyszłe /admin).
export async function requireRolePage(roles: Role[]): Promise<User> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!roles.includes(user.role)) redirect('/')
  return user
}
