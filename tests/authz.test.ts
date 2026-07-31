import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role, User } from '@prisma/client'
import { assertRole, AuthorizationError } from '@/lib/auth/roles'

// --- mocki dla testów reprezentatywnych server actions ---
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    version: { findUnique: vi.fn() },
    versionComment: { create: vi.fn() },
  },
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { createVersion } from '@/app/actions/versions'
import { addComment } from '@/app/actions/comments'
import { VersionClosedError } from '@/lib/versions/guard'

const mockedGetSessionUser = vi.mocked(getSessionUser)
const mockedFindVersion = vi.mocked(prisma.version.findUnique)

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

describe('mutacja na zamkniętej wersji (read-only wymuszone po stronie serwera)', () => {
  beforeEach(() => {
    mockedGetSessionUser.mockReset()
    mockedFindVersion.mockReset()
  })

  it('addComment na wersji RELEASED jest odrzucone', async () => {
    mockedGetSessionUser.mockResolvedValue(user('TESTER'))
    // @ts-expect-error — mock zwraca tylko wybrane pola (select: { status })
    mockedFindVersion.mockResolvedValue({ status: 'RELEASED' })

    await expect(addComment('v1', 'treść')).rejects.toBeInstanceOf(
      VersionClosedError,
    )
  })

  it('TESTER z poprawną rolą, ale wersja CANCELLED → też odmowa', async () => {
    mockedGetSessionUser.mockResolvedValue(user('ADMIN'))
    // @ts-expect-error — mock zwraca tylko wybrane pola (select: { status })
    mockedFindVersion.mockResolvedValue({ status: 'CANCELLED' })

    await expect(addComment('v1', 'treść')).rejects.toBeInstanceOf(
      VersionClosedError,
    )
  })
})
