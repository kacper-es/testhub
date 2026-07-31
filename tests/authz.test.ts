import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role, User } from '@prisma/client'
import { assertRole, AuthorizationError } from '@/lib/auth/roles'

// --- mocki dla testu reprezentatywnej server action (createVersion) ---
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getSessionUser } from '@/lib/auth/session'
import { createVersion } from '@/app/actions/versions'

const mockedGetSessionUser = vi.mocked(getSessionUser)

function user(role: Role, isActive = true): User {
  return {
    id: 'u1',
    email: 'x@example.com',
    passwordHash: 'hash',
    name: 'X',
    role,
    isActive,
    mustChangePassword: false,
    theme: 'SYSTEM',
    createdAt: new Date(),
  }
}

describe('assertRole', () => {
  it('dopuszcza rolę z listy', () => {
    expect(() => assertRole(user('ADMIN'), ['TESTER', 'ADMIN'])).not.toThrow()
    expect(() => assertRole(user('TESTER'), ['TESTER', 'ADMIN'])).not.toThrow()
  })

  it('odrzuca PM (read-only) na akcji mutującej', () => {
    expect(() => assertRole(user('PM'), ['TESTER', 'ADMIN'])).toThrow(
      AuthorizationError,
    )
  })

  it('odrzuca brak zalogowanego użytkownika', () => {
    expect(() => assertRole(null, ['TESTER', 'ADMIN'])).toThrow(
      AuthorizationError,
    )
  })

  it('odrzuca nieaktywnego użytkownika mimo poprawnej roli', () => {
    expect(() => assertRole(user('ADMIN', false), ['ADMIN'])).toThrow(
      AuthorizationError,
    )
  })
})

describe('createVersion (reprezentatywna server action)', () => {
  beforeEach(() => mockedGetSessionUser.mockReset())

  it('PM dostaje odmowę — mutacja nie wykonuje się', async () => {
    mockedGetSessionUser.mockResolvedValue(user('PM'))
    await expect(createVersion({}, new FormData())).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('niezalogowany dostaje odmowę', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(createVersion({}, new FormData())).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })
})
