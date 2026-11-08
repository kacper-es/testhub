import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  ensureInitialAdmin,
  INITIAL_ADMIN_EMAIL,
  INITIAL_ADMIN_PASSWORD,
} from '@/lib/auth/bootstrap'
import { verifyPassword } from '@/lib/auth/password'

function db(count: number, create = vi.fn().mockResolvedValue({})) {
  return { user: { count: vi.fn().mockResolvedValue(count), create } } as never
}

describe('ensureInitialAdmin', () => {
  it('empty User table → creates ADMIN with forced password change', async () => {
    const create = vi.fn().mockResolvedValue({})
    expect(await ensureInitialAdmin(db(0, create))).toBe('created')

    const data = create.mock.calls[0][0].data
    expect(data).toMatchObject({
      email: INITIAL_ADMIN_EMAIL,
      role: 'ADMIN',
      mustChangePassword: true,
    })
    expect(await verifyPassword(INITIAL_ADMIN_PASSWORD, data.passwordHash)).toBe(true)
  })

  it('any existing user (also inactive) → does nothing', async () => {
    const create = vi.fn()
    expect(await ensureInitialAdmin(db(1, create))).toBe('skipped')
    expect(create).not.toHaveBeenCalled()
  })

  it('concurrent start (P2002) → skipped, no error', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    })
    const create = vi.fn().mockRejectedValue(err)
    expect(await ensureInitialAdmin(db(0, create))).toBe('skipped')
  })

  it('other database errors propagate', async () => {
    const create = vi.fn().mockRejectedValue(new Error('db down'))
    await expect(ensureInitialAdmin(db(0, create))).rejects.toThrow('db down')
  })
})
