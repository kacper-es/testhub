import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role, User } from '@prisma/client'

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    jiraTrackedType: { updateMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return { prisma }
})

import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { AuthorizationError } from '@/lib/auth/roles'
import { setJiraTrackedTypes } from '@/app/actions/jira'
import { groupIssuesByType, trackedTypeOptions } from '@/lib/jira/issue-types'

const db = vi.mocked(prisma, true)

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
    palette: 'LIME',
    createdAt: new Date(),
  }
}

function form(types: string[]) {
  const f = new FormData()
  for (const t of types) f.append('types', t)
  return f
}

const issue = (key: string, issueType: string, statusCategory = 'new') => ({
  key,
  issueType,
  statusCategory,
})

describe('groupIssuesByType (J-7)', () => {
  const issues = [
    issue('A-1', 'Bug prod', 'done'),
    issue('A-2', 'Bug prod'),
    issue('A-3', 'Improvement', 'done'),
    issue('A-4', 'Task'),
    issue('A-5', 'Sub-task', 'done'),
    issue('A-6', 'Task'),
  ]

  it('groups tracked types in the given order, counting done', () => {
    const b = groupIssuesByType(issues, ['Bug prod', 'Improvement', 'New feature'])
    expect(b.groups.map((g) => [g.name, g.issues.map((i) => i.key), g.done])).toEqual([
      ['Bug prod', ['A-1', 'A-2'], 1],
      ['Improvement', ['A-3'], 1],
      ['New feature', [], 0],
    ])
  })

  it('puts the rest in "Inne" with the number of distinct types', () => {
    const b = groupIssuesByType(issues, ['Bug prod', 'Improvement'])
    expect(b.other.issues.map((i) => i.key)).toEqual(['A-4', 'A-5', 'A-6'])
    expect(b.other.done).toBe(1)
    expect(b.other.typeCount).toBe(2)
  })

  it('matches type names exactly', () => {
    const b = groupIssuesByType(issues, ['bug prod'])
    expect(b.groups[0].issues).toEqual([])
    expect(b.other.issues).toHaveLength(6)
  })
})

describe('trackedTypeOptions (J-7)', () => {
  it('unions seen and tracked types, alphabetically, with counts and checks', () => {
    expect(
      trackedTypeOptions(
        [
          { issueType: 'Task', count: 5 },
          { issueType: 'Bug prod', count: 2 },
          { issueType: '', count: 1 },
        ],
        ['New feature', 'Bug prod'],
      ),
    ).toEqual([
      { name: 'Bug prod', count: 2, checked: true },
      { name: 'New feature', count: 0, checked: true },
      { name: 'Task', count: 5, checked: false },
    ])
  })
})

describe('setJiraTrackedTypes (J-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)) as never)
  })

  it.each<Role>(['TESTER', 'PM'])('%s is refused', async (role) => {
    vi.mocked(getSessionUser).mockResolvedValue(user(role))
    await expect(setJiraTrackedTypes({}, form(['Bug prod']))).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    expect(db.jiraTrackedType.upsert).not.toHaveBeenCalled()
  })

  it('ADMIN: deactivates unchecked types and upserts checked ones (deduplicated)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(user('ADMIN'))
    const res = await setJiraTrackedTypes({}, form(['Bug prod', ' Improvement ', 'Bug prod']))
    expect(res).toEqual({ saved: true })
    expect(db.jiraTrackedType.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, name: { notIn: ['Bug prod', 'Improvement'] } },
      data: { isActive: false, updatedById: 'u1' },
    })
    expect(db.jiraTrackedType.upsert).toHaveBeenCalledTimes(2)
    expect(db.jiraTrackedType.upsert).toHaveBeenCalledWith({
      where: { name: 'Improvement' },
      create: { name: 'Improvement', updatedById: 'u1' },
      update: { isActive: true, updatedById: 'u1' },
    })
  })

  it('ADMIN: empty selection deactivates everything', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(user('ADMIN'))
    await setJiraTrackedTypes({}, form([]))
    expect(db.jiraTrackedType.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, name: { notIn: [] } },
      data: { isActive: false, updatedById: 'u1' },
    })
    expect(db.jiraTrackedType.upsert).not.toHaveBeenCalled()
  })

  it('ADMIN: invalid input → error, nothing saved', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(user('ADMIN'))
    const res = await setJiraTrackedTypes({}, form(['x'.repeat(101)]))
    expect(res).toEqual({ error: 'Za długa nazwa typu' })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
