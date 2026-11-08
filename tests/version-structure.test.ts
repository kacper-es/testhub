import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role, User } from '@prisma/client'

const tx = {
  version: { findUnique: vi.fn(), delete: vi.fn() },
  taskTemplate: { findMany: vi.fn() },
  versionTask: { createMany: vi.fn() },
  changeLog: { create: vi.fn() },
}

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getSessionUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { addVersionTasks, deleteVersion } from '@/app/actions/versions'
import { AuthorizationError } from '@/lib/auth/roles'
import { VersionClosedError } from '@/lib/versions/guard'

const mockedUser = vi.mocked(getSessionUser)

function user(role: Role): User {
  return {
    id: 'u1',
    email: 'x@example.com',
    passwordHash: 'hash',
    name: 'X',
    role,
    isActive: true,
    mustChangePassword: false,
    theme: 'SYSTEM',
    createdAt: new Date(),
  }
}

function form(data: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(data)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('addVersionTasks (reguła 6)', () => {
  it('PM dostaje odmowę', async () => {
    mockedUser.mockResolvedValue(user('PM'))
    await expect(addVersionTasks(form({ versionId: 'v1' }))).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    expect(tx.versionTask.createMany).not.toHaveBeenCalled()
  })

  it('zamknięta wersja → odmowa', async () => {
    mockedUser.mockResolvedValue(user('TESTER'))
    tx.version.findUnique.mockResolvedValue({ status: 'RELEASED' })
    await expect(addVersionTasks(form({ versionId: 'v1' }))).rejects.toBeInstanceOf(
      VersionClosedError,
    )
    expect(tx.versionTask.createMany).not.toHaveBeenCalled()
  })

  it('„dodaj wszystkie" → tylko aktywne szablony nieobecne w wersji', async () => {
    mockedUser.mockResolvedValue(user('TESTER'))
    tx.version.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' })
    tx.taskTemplate.findMany.mockResolvedValue([{ id: 't2' }, { id: 't3' }])

    await addVersionTasks(form({ versionId: 'v1', templateId: '' }))

    expect(tx.taskTemplate.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      versionTasks: { none: { versionId: 'v1' } },
    })
    expect(tx.versionTask.createMany).toHaveBeenCalledWith({
      data: [
        { versionId: 'v1', taskTemplateId: 't2' },
        { versionId: 'v1', taskTemplateId: 't3' },
      ],
      skipDuplicates: true,
    })
  })

  it('pojedynczy szablon już obecny lub nieaktywny → błąd', async () => {
    mockedUser.mockResolvedValue(user('ADMIN'))
    tx.version.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' })
    tx.taskTemplate.findMany.mockResolvedValue([])
    await expect(
      addVersionTasks(form({ versionId: 'v1', templateId: 't1' })),
    ).rejects.toThrow('Szablon jest nieaktywny albo już jest w tej wersji')
  })
})

describe('deleteVersion (tylko ADMIN)', () => {
  it.each(['PM', 'TESTER'] as const)('%s dostaje odmowę', async (role) => {
    mockedUser.mockResolvedValue(user(role))
    await expect(
      deleteVersion({}, form({ versionId: 'v1', confirmName: '1.0' })),
    ).rejects.toBeInstanceOf(AuthorizationError)
    expect(tx.version.delete).not.toHaveBeenCalled()
  })

  it('niezgodna nazwa → błąd, nic nie usunięte', async () => {
    mockedUser.mockResolvedValue(user('ADMIN'))
    tx.version.findUnique.mockResolvedValue({ name: '1.0' })
    const res = await deleteVersion({}, form({ versionId: 'v1', confirmName: '1.1' }))
    expect(res).toEqual({ error: 'Nazwa nie zgadza się z nazwą wersji' })
    expect(tx.version.delete).not.toHaveBeenCalled()
    expect(tx.changeLog.create).not.toHaveBeenCalled()
  })

  it('zgodna nazwa → wpis w ChangeLog, usunięcie, przekierowanie', async () => {
    mockedUser.mockResolvedValue(user('ADMIN'))
    tx.version.findUnique.mockResolvedValue({ name: '1.0' })

    await expect(
      deleteVersion({}, form({ versionId: 'v1', confirmName: ' 1.0 ' })),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.changeLog.create).toHaveBeenCalledWith({
      data: {
        entityType: 'Version',
        entityId: 'v1',
        versionId: null,
        field: 'deleted',
        oldValue: '1.0',
        newValue: null,
        userId: 'u1',
      },
    })
    expect(tx.version.delete).toHaveBeenCalledWith({ where: { id: 'v1' } })
    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/versions')
  })
})
