import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role, User } from '@prisma/client'
import { ticketTaskView } from '@/lib/versions/ticket-source'

const base = {
  versionStatus: 'IN_PROGRESS' as const,
  jiraMapped: false,
  jiraSynced: false,
  jiraConfigured: false,
  manual: { current: 2, total: 5 },
  jira: { done: 7, total: 10 },
}

describe('ticketTaskView (J-4)', () => {
  it('mapped + synced → numbers from Jira (open and closed)', () => {
    const v = ticketTaskView({ ...base, jiraMapped: true, jiraSynced: true, jiraConfigured: true })
    expect(v).toEqual({ mode: 'jira', current: 7, total: 10, status: 'IN_PROGRESS' })
    const closed = ticketTaskView({
      ...base,
      versionStatus: 'RELEASED',
      jiraMapped: true,
      jiraSynced: true,
    })
    expect(closed.mode).toBe('jira')
  })

  it('all Jira tickets done → DONE', () => {
    const v = ticketTaskView({
      ...base,
      jiraMapped: true,
      jiraSynced: true,
      jira: { done: 3, total: 3 },
    })
    expect(v.status).toBe('DONE')
  })

  it('mapped, never synced, open → jira-unsynced with no numbers', () => {
    const v = ticketTaskView({ ...base, jiraMapped: true, jiraConfigured: true })
    expect(v).toEqual({ mode: 'jira-unsynced', current: 0, total: 0, status: 'NOT_STARTED' })
  })

  it('integration configured, open, unmapped → unmapped (manual counter off)', () => {
    const v = ticketTaskView({ ...base, jiraConfigured: true })
    expect(v.mode).toBe('unmapped')
    expect(v.total).toBe(0)
  })

  it('integration not configured, open → manual counters as before', () => {
    const v = ticketTaskView(base)
    expect(v).toEqual({ mode: 'manual-edit', current: 2, total: 5, status: 'IN_PROGRESS' })
  })

  it('closed, unmapped → historical manual values, read-only', () => {
    const v = ticketTaskView({ ...base, versionStatus: 'CANCELLED', jiraConfigured: true })
    expect(v).toEqual({ mode: 'manual-readonly', current: 2, total: 5, status: 'IN_PROGRESS' })
  })
})

// --- setTicketCounters guard -------------------------------------------------

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { versionTask: { findUnique: vi.fn() }, $transaction: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { setTicketCounters } from '@/app/actions/tasks'

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

function task(version: { jiraVersionId: string | null; jiraSyncedAt: Date | null }) {
  return {
    id: 't1',
    manualCounterCurrent: 0,
    manualCounterTotal: 0,
    version: { status: 'IN_PROGRESS', ...version },
    taskTemplate: { taskType: 'TICKET_AGGREGATE' },
  }
}

describe('setTicketCounters with Jira (J-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.mocked(getSessionUser).mockResolvedValue(user('TESTER'))
  })

  it('version mapped to Jira → manual change refused', async () => {
    // @ts-expect-error — partial mock
    vi.mocked(prisma.versionTask.findUnique).mockResolvedValue(
      task({ jiraVersionId: '1', jiraSyncedAt: new Date() }),
    )
    const res = await setTicketCounters('t1', 1, 2)
    expect(res).toEqual({
      error: 'Licznik ticketów jest liczony z Jiry — ręczna zmiana jest wyłączona.',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('integration configured, version unmapped → refused', async () => {
    vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net')
    vi.stubEnv('JIRA_EMAIL', 'bot@acme.com')
    vi.stubEnv('JIRA_API_TOKEN', 'secret-token')
    // @ts-expect-error — partial mock
    vi.mocked(prisma.versionTask.findUnique).mockResolvedValue(
      task({ jiraVersionId: null, jiraSyncedAt: null }),
    )
    const res = await setTicketCounters('t1', 1, 2)
    expect(res).toHaveProperty('error')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('integration not configured → manual change goes through', async () => {
    vi.stubEnv('JIRA_BASE_URL', '')
    vi.stubEnv('JIRA_EMAIL', '')
    vi.stubEnv('JIRA_API_TOKEN', '')
    // @ts-expect-error — partial mock
    vi.mocked(prisma.versionTask.findUnique).mockResolvedValue(
      task({ jiraVersionId: null, jiraSyncedAt: null }),
    )
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never)
    await setTicketCounters('t1', 1, 2)
    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
