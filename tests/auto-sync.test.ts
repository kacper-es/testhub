import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = { $queryRaw: vi.fn() }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    $queryRaw: vi.fn(),
  },
}))
vi.mock('@/lib/jira/sync-version', () => ({ syncAllOpenVersions: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { syncAllOpenVersions } from '@/lib/jira/sync-version'
import { readSyncInterval, runAutoSyncOnce, lastAutoSyncRun } from '@/lib/jira/auto-sync'
import { GET as health } from '@/app/health/route'

function configureJira() {
  vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net')
  vi.stubEnv('JIRA_EMAIL', 'bot@acme.com')
  vi.stubEnv('JIRA_API_TOKEN', 'secret-token')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('readSyncInterval (J-6)', () => {
  it('unset or empty → default 30 min', () => {
    expect(readSyncInterval(undefined)).toEqual({ status: 'on', minutes: 30 })
    expect(readSyncInterval('  ')).toEqual({ status: 'on', minutes: 30 })
  })
  it('0 → off', () => {
    expect(readSyncInterval('0')).toEqual({ status: 'off' })
  })
  it('1..1440 → minutes', () => {
    expect(readSyncInterval('5')).toEqual({ status: 'on', minutes: 5 })
    expect(readSyncInterval('1440')).toEqual({ status: 'on', minutes: 1440 })
  })
  it('garbage, negative, fractional, too large → invalid', () => {
    for (const raw of ['abc', '-5', '1.5', '1441', '30m']) {
      expect(readSyncInterval(raw).status).toBe('invalid')
    }
  })
})

describe('runAutoSyncOnce (J-6)', () => {
  it('Jira not configured → nothing happens', async () => {
    vi.stubEnv('JIRA_BASE_URL', '')
    expect(await runAutoSyncOnce()).toBeNull()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('lock held elsewhere → skipped, no sync', async () => {
    configureJira()
    tx.$queryRaw.mockResolvedValue([{ locked: false }])
    const run = await runAutoSyncOnce()
    expect(run?.skipped).toBe(true)
    expect(syncAllOpenVersions).not.toHaveBeenCalled()
  })

  it('lock acquired → syncs all, records failures without secrets', async () => {
    configureJira()
    tx.$queryRaw.mockResolvedValue([{ locked: true }])
    vi.mocked(syncAllOpenVersions).mockResolvedValue([
      { versionId: 'v1', name: '1.0', ok: true, message: '3 ticketów, 1 gotowych' },
      { versionId: 'v2', name: '2.0', ok: false, message: 'Brak dostępu' },
    ])
    const run = await runAutoSyncOnce()
    expect(run).toMatchObject({ versions: 2, failed: [{ name: '2.0', message: 'Brak dostępu' }] })
    expect(lastAutoSyncRun()).toBe(run)
    expect(JSON.stringify(run)).not.toContain('secret-token')
  })

  it('unexpected error → generic message, does not throw', async () => {
    configureJira()
    tx.$queryRaw.mockRejectedValue(new Error('boom https://bot:secret-token@x'))
    const run = await runAutoSyncOnce()
    expect(run?.failed[0]?.message).toBe('Nieoczekiwany błąd automatycznej synchronizacji.')
    expect(JSON.stringify(run)).not.toContain('secret-token')
  })
})

describe('/health', () => {
  it('database answers → 200 with OK', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }] as never)
    const res = await health()
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('OK</p>')
  })

  it('database down → 503', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connection refused'))
    const res = await health()
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('OK</p>')
  })
})
