import { describe, it, expect } from 'vitest'
import type { Role, User } from '@prisma/client'
import { assertRole, AuthorizationError } from '@/lib/auth/roles'

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
