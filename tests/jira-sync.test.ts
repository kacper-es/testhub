import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role, User } from '@prisma/client'
import { fetchFixVersionIssues, mapIssue, TooManyIssuesError } from '@/lib/jira/issues'
import { applyIssueSync } from '@/lib/jira/sync'
import { JiraError } from '@/lib/jira/client'
import type { JiraConfig } from '@/lib/jira/config'

const config: JiraConfig = {
  baseUrl: 'https://acme.atlassian.net',
  email: 'bot@acme.com',
  apiToken: 'secret-token',
}

function raw(id: string, cat = 'new') {
  return {
    id,
    key: `ABC-${id}`,
    fields: {
      summary: `Ticket ${id}`,
      issuetype: { name: 'Bug' },
      status: { name: cat === 'done' ? 'Done' : 'To Do', statusCategory: { key: cat } },
      assignee: { displayName: 'Anna' },
      updated: '2026-11-08T10:00:00.000+0100',
    },
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('mapIssue', () => {
  it('maps fields', () => {
    expect(mapIssue(raw('10', 'done'))).toEqual({
      jiraId: '10',
      key: 'ABC-10',
      summary: 'Ticket 10',
      issueType: 'Bug',
      statusName: 'Done',
      statusCategory: 'done',
      assigneeName: 'Anna',
      jiraUpdatedAt: new Date('2026-11-08T09:00:00.000Z'),
    })
  })

  it('missing optional fields → safe defaults', () => {
    const m = mapIssue({ id: '1', key: 'ABC-1', fields: {} })
    expect(m.assigneeName).toBeNull()
    expect(m.summary).toBe('')
    expect(m.statusCategory).toBe('undefined')
  })
})

describe('fetchFixVersionIssues', () => {
  it('follows nextPageToken until isLast', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ issues: [raw('1'), raw('2')], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ issues: [raw('3')], isLast: true }))

    const out = await fetchFixVersionIssues(config, '10001', { fetchFn })
    expect(out.map((i) => i.key)).toEqual(['ABC-1', 'ABC-2', 'ABC-3'])

    const first = new URL(fetchFn.mock.calls[0][0])
    expect(first.pathname).toBe('/rest/api/3/search/jql')
    expect(first.searchParams.get('jql')).toBe('fixVersion = 10001 ORDER BY key ASC')
    expect(first.searchParams.get('nextPageToken')).toBeNull()
    expect(new URL(fetchFn.mock.calls[1][0]).searchParams.get('nextPageToken')).toBe('p2')
  })

  it('429 → waits Retry-After and retries', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { 'retry-after': '5' }))
      .mockResolvedValueOnce(json({ issues: [raw('1')], isLast: true }))

    const out = await fetchFixVersionIssues(config, '10001', { fetchFn, sleep })
    expect(out).toHaveLength(1)
    expect(sleep).toHaveBeenCalledWith(5000)
  })

  it('429 beyond the retry limit → JiraError rate_limited', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fetchFn = vi.fn().mockImplementation(async () => json({}, 429, { 'retry-after': '1' }))
    await expect(
      fetchFixVersionIssues(config, '10001', { fetchFn, sleep }),
    ).rejects.toMatchObject({ kind: 'rate_limited' })
    expect(fetchFn).toHaveBeenCalledTimes(4) // 1 + 3 retries
  })

  it('401 is not retried', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}, 401))
    await expect(fetchFixVersionIssues(config, '10001', { fetchFn })).rejects.toBeInstanceOf(
      JiraError,
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('endless pagination → TooManyIssuesError', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => json({ issues: [], nextPageToken: 'x' }))
    await expect(fetchFixVersionIssues(config, '10001', { fetchFn })).rejects.toBeInstanceOf(
      TooManyIssuesError,
    )
  })

  it('non-numeric version id never reaches JQL', async () => {
    const fetchFn = vi.fn()
    await expect(
      fetchFixVersionIssues(config, '1 OR project = X', { fetchFn }),
    ).rejects.toBeInstanceOf(JiraError)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('applyIssueSync', () => {
  it('upserts returned issues, marks missing ones removed, stamps the version', async () => {
    const tx = {
      jiraIssue: {
        upsert: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      version: { update: vi.fn().mockResolvedValue({}) },
      jiraSnapshot: { upsert: vi.fn().mockResolvedValue({}) },
    }
    const now = new Date('2026-11-08T12:00:00Z')
    const issues = [mapIssue(raw('1', 'done')), mapIssue(raw('2'))]

    const res = await applyIssueSync(tx as never, 'v1', issues, now)

    expect(res).toEqual({ total: 2, done: 1, removed: 2 })
    expect(tx.jiraIssue.upsert).toHaveBeenCalledTimes(2)
    const firstUpsert = tx.jiraIssue.upsert.mock.calls[0][0]
    expect(firstUpsert.where).toEqual({ versionId_jiraId: { versionId: 'v1', jiraId: '1' } })
    expect(firstUpsert.update.removedAt).toBeNull() // a returning ticket is restored
    expect(tx.jiraIssue.updateMany).toHaveBeenCalledWith({
      where: { versionId: 'v1', removedAt: null, jiraId: { notIn: ['1', '2'] } },
      data: { removedAt: now },
    })
    expect(tx.version.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { jiraSyncedAt: now },
    })
    // UI-2b: daily snapshot for the burn-up, keyed by the Warsaw date
    expect(tx.jiraSnapshot.upsert).toHaveBeenCalledWith({
      where: { versionId_day: { versionId: 'v1', day: new Date('2026-11-08T00:00:00Z') } },
      create: { versionId: 'v1', day: new Date('2026-11-08T00:00:00Z'), total: 2, done: 1, inProgress: 0 },
      update: { total: 2, done: 1, inProgress: 0 },
    })
  })

  it('snapshot day follows Warsaw time, not UTC', async () => {
    const tx = {
      jiraIssue: { upsert: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      version: { update: vi.fn() },
      jiraSnapshot: { upsert: vi.fn() },
    }
    // 23:30 UTC on Nov 8 = 00:30 on Nov 9 in Warsaw
    await applyIssueSync(tx as never, 'v1', [], new Date('2026-11-08T23:30:00Z'))
    expect(tx.jiraSnapshot.upsert.mock.calls[0][0].where.versionId_day.day).toEqual(
      new Date('2026-11-09T00:00:00Z'),
    )
  })
})

// --- actions: authorization and guards ---------------------------------------

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { version: { findUnique: vi.fn(), findMany: vi.fn() }, $transaction: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { syncAllOpenJiraVersions, syncVersionJiraIssues } from '@/app/actions/jira'
import { AuthorizationError } from '@/lib/auth/roles'

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

function form(versionId: string) {
  const f = new FormData()
  f.set('versionId', versionId)
  return f
}

describe('sync actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net')
    vi.stubEnv('JIRA_EMAIL', 'bot@acme.com')
    vi.stubEnv('JIRA_API_TOKEN', 'secret-token')
  })

  it.each(['PM', 'TESTER'] as const)('%s is refused (single and all)', async (role) => {
    vi.mocked(getSessionUser).mockResolvedValue(user(role))
    await expect(syncVersionJiraIssues({ status: 'idle' }, form('v1'))).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    await expect(
      syncAllOpenJiraVersions({ status: 'idle' }, new FormData()),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('closed version → error, nothing written', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(user('ADMIN'))
    // @ts-expect-error — partial select mock
    vi.mocked(prisma.version.findUnique).mockResolvedValue({ status: 'RELEASED', jiraVersionId: '1' })
    const res = await syncVersionJiraIssues({ status: 'idle' }, form('v1'))
    expect(res).toEqual({
      status: 'error',
      error: 'Wersja jest zamknięta — synchronizacja tylko dla otwartych.',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('version without a Jira mapping → error', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(user('ADMIN'))
    // @ts-expect-error — partial select mock
    vi.mocked(prisma.version.findUnique).mockResolvedValue({ status: 'IN_PROGRESS', jiraVersionId: null })
    const res = await syncVersionJiraIssues({ status: 'idle' }, form('v1'))
    expect(res).toEqual({ status: 'error', error: 'Wersja nie jest podpięta do wersji Jira.' })
  })

  it('Jira not configured → error before any query', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(user('ADMIN'))
    vi.stubEnv('JIRA_API_TOKEN', '')
    const res = await syncVersionJiraIssues({ status: 'idle' }, form('v1'))
    expect(res.status).toBe('error')
    expect(prisma.version.findUnique).not.toHaveBeenCalled()
  })
})
