import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Role, User } from '@prisma/client'

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    application: { findUnique: vi.fn(), update: vi.fn() },
    version: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    changeLog: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return { prisma }
})

import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { AuthorizationError } from '@/lib/auth/roles'
import { selectableJiraVersions } from '@/lib/jira/versions'
import { applicationJiraSchema, versionJiraSchema } from '@/lib/validation/jira'
import { setApplicationJiraProject, setVersionJiraVersion } from '@/app/actions/jira'
import type { JiraProjectVersion } from '@/lib/jira/client'

const mockedUser = vi.mocked(getSessionUser)
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
    createdAt: new Date(),
  }
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function v(id: string, extra: Partial<JiraProjectVersion> = {}): JiraProjectVersion {
  return { id, name: `v${id}`, released: false, archived: false, releaseDate: null, ...extra }
}

describe('selectableJiraVersions', () => {
  it('pomija wydane i zarchiwizowane, ale zostawia aktualnie podpiętą', () => {
    const list = [v('1', { released: true }), v('2', { archived: true }), v('3'), v('4', { released: true })]
    expect(selectableJiraVersions(list, '4').map((x) => x.id)).toEqual(['3', '4'])
  })

  it('sortuje po dacie wydania (bez daty na końcu), potem po nazwie', () => {
    const list = [
      v('1', { name: 'b' }),
      v('2', { releaseDate: '2026-12-01' }),
      v('3', { releaseDate: '2026-11-01' }),
      v('4', { name: 'a' }),
    ]
    expect(selectableJiraVersions(list, null).map((x) => x.id)).toEqual(['3', '2', '4', '1'])
  })
})

describe('walidacja mapowania', () => {
  it('klucz projektu: wielkie litery, puste = null', () => {
    expect(applicationJiraSchema.parse({ applicationId: 'a', projectKey: ' abc ' }).projectKey).toBe('ABC')
    expect(applicationJiraSchema.parse({ applicationId: 'a', projectKey: '' }).projectKey).toBeNull()
    expect(applicationJiraSchema.safeParse({ applicationId: 'a', projectKey: '1AB' }).success).toBe(false)
    expect(applicationJiraSchema.safeParse({ applicationId: 'a', projectKey: 'A-B' }).success).toBe(false)
  })

  it('id wersji Jira: tylko cyfry, puste = null', () => {
    expect(versionJiraSchema.parse({ versionId: 'x', jiraVersionId: '10001' }).jiraVersionId).toBe('10001')
    expect(versionJiraSchema.parse({ versionId: 'x', jiraVersionId: '' }).jiraVersionId).toBeNull()
    expect(versionJiraSchema.safeParse({ versionId: 'x', jiraVersionId: '../x' }).success).toBe(false)
  })
})

describe('akcje mapowania — tylko ADMIN', () => {
  beforeEach(() => mockedUser.mockReset())

  it.each(['PM', 'TESTER'] as const)('%s dostaje odmowę w obu akcjach', async (role) => {
    mockedUser.mockResolvedValue(user(role))
    await expect(
      setApplicationJiraProject({}, form({ applicationId: 'a', projectKey: 'ABC' })),
    ).rejects.toBeInstanceOf(AuthorizationError)
    await expect(
      setVersionJiraVersion({}, form({ versionId: 'v', jiraVersionId: '1' })),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('akcje mapowania — logika (Jira i baza zasymulowane)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUser.mockResolvedValue(user('ADMIN'))
    vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net')
    vi.stubEnv('JIRA_EMAIL', 'bot@acme.com')
    vi.stubEnv('JIRA_API_TOKEN', 'secret')
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('zmiana klucza zablokowana, gdy otwarte wersje są podpięte', async () => {
    db.application.findUnique.mockResolvedValue({ jiraProjectKey: 'OLD' } as never)
    db.version.findMany.mockResolvedValue([{ name: '1.2.0' }] as never)

    const res = await setApplicationJiraProject({}, form({ applicationId: 'a', projectKey: 'NEW' }))
    expect(res.error).toContain('1.2.0')
    expect(db.application.update).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('nieistniejący projekt w Jirze → komunikat, bez zapisu', async () => {
    db.application.findUnique.mockResolvedValue({ jiraProjectKey: null } as never)
    db.version.findMany.mockResolvedValue([] as never)
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    const res = await setApplicationJiraProject({}, form({ applicationId: 'a', projectKey: 'abc' }))
    expect(res.error).toContain('ABC')
    expect(db.application.update).not.toHaveBeenCalled()
  })

  it('poprawny projekt → zapis kanonicznego klucza z Jiry', async () => {
    db.application.findUnique.mockResolvedValue({ jiraProjectKey: null } as never)
    db.version.findMany.mockResolvedValue([] as never)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1', key: 'ABC', name: 'Projekt ABC' }))

    const res = await setApplicationJiraProject({}, form({ applicationId: 'a', projectKey: 'abc' }))
    expect(res).toEqual({ saved: true })
    expect(db.application.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { jiraProjectKey: 'ABC' },
    })
  })

  const openVersion = {
    status: 'IN_PROGRESS',
    jiraVersionId: null,
    jiraVersionName: null,
    application: { jiraProjectKey: 'ABC' },
  }

  it('wersja spoza projektu jest odrzucana (nie ufamy klientowi)', async () => {
    db.version.findUnique.mockResolvedValue(openVersion as never)
    fetchMock.mockResolvedValue(jsonResponse([{ id: '1', name: '1.0' }]))

    const res = await setVersionJiraVersion({}, form({ versionId: 'v', jiraVersionId: '999' }))
    expect(res.error).toContain('nie należy do projektu ABC')
    expect(db.version.update).not.toHaveBeenCalled()
  })

  it('wydana wersja Jira jest odrzucana', async () => {
    db.version.findUnique.mockResolvedValue(openVersion as never)
    fetchMock.mockResolvedValue(jsonResponse([{ id: '1', name: '1.0', released: true }]))

    const res = await setVersionJiraVersion({}, form({ versionId: 'v', jiraVersionId: '1' }))
    expect(res.error).toContain('wydana')
    expect(db.version.update).not.toHaveBeenCalled()
  })

  it('podpięcie zapisuje id + nazwę i loguje zmianę', async () => {
    db.version.findUnique.mockResolvedValue(openVersion as never)
    fetchMock.mockResolvedValue(jsonResponse([{ id: '1', name: '1.0' }, { id: '2', name: '2.0' }]))

    const res = await setVersionJiraVersion({}, form({ versionId: 'v', jiraVersionId: '2' }))
    expect(res).toEqual({ saved: true })
    expect(db.version.update).toHaveBeenCalledWith({
      where: { id: 'v' },
      data: { jiraVersionId: '2', jiraVersionName: '2.0' },
    })
    expect(db.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ field: 'jiraVersion', oldValue: null, newValue: '2.0' }),
    })
  })

  it('odpięcie działa bez Jiry (brak zapytania)', async () => {
    db.version.findUnique.mockResolvedValue({
      ...openVersion,
      jiraVersionId: '2',
      jiraVersionName: '2.0',
    } as never)

    const res = await setVersionJiraVersion({}, form({ versionId: 'v', jiraVersionId: '' }))
    expect(res).toEqual({ saved: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ oldValue: '2.0', newValue: null }),
    })
  })

  it('zamknięta wersja — odmowa', async () => {
    db.version.findUnique.mockResolvedValue({ ...openVersion, status: 'RELEASED' } as never)
    await expect(
      setVersionJiraVersion({}, form({ versionId: 'v', jiraVersionId: '1' })),
    ).rejects.toThrow('zamknięta')
  })
})
