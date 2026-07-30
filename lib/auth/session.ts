import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import { cache } from 'react'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE } from '@/lib/auth/cookie'

export { SESSION_COOKIE }

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 h
// Odśwież rekord w bazie tylko gdy minęła ~1 h od ostatniego odświeżenia
// (unika zapisu przy każdym pollingu co 5 s).
const DB_REFRESH_AFTER_MS = 60 * 60 * 1000

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not set')
  return s
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex')
}

function serialize(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`
}

// Zwraca sessionId jeśli podpis się zgadza, inaczej null.
function parse(raw: string): string | null {
  const idx = raw.lastIndexOf('.')
  if (idx <= 0) return null
  const id = raw.slice(0, idx)
  const mac = Buffer.from(raw.slice(idx + 1))
  const expected = Buffer.from(sign(id))
  if (mac.length !== expected.length) return null
  if (!timingSafeEqual(mac, expected)) return null
  return id
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  }
}

// Tworzy sesję w bazie i ustawia cookie. Wolno wywoływać tylko z Server Action
// / Route Handler (ustawia cookie).
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  const session = await prisma.session.create({ data: { userId, expiresAt } })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, serialize(session.id), cookieOptions(expiresAt))
}

// Odczyt bieżącego użytkownika. Bezpieczne w Server Componentach (nie zapisuje
// cookie — przesuwanie ważności cookie robi middleware). Może odświeżyć
// `expiresAt` w bazie (zapis do DB, nie cookie). Zdeduplikowane w obrębie renderu.
export const getSessionUser = cache(async (): Promise<User | null> => {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null

  const sessionId = parse(raw)
  if (!sessionId) return null

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })
  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.user.isActive) return null

  // Rolling refresh (tylko rekord w bazie, z throttlingiem).
  const elapsed = SESSION_TTL_MS - (session.expiresAt.getTime() - Date.now())
  if (elapsed > DB_REFRESH_AFTER_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => {})
  }

  return session.user
})

// Wylogowanie: usuwa rekord sesji i czyści cookie. Tylko z Server Action.
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (raw) {
    const sessionId = parse(raw)
    if (sessionId) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
    }
  }
  jar.delete(SESSION_COOKIE)
}

// Usuwa wszystkie sesje użytkownika (zmiana hasła, dezaktywacja konta w 3b).
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}
