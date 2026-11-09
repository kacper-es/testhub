import { prisma } from '@/lib/prisma'
import { readJiraConfig } from '@/lib/jira/config'
import { syncAllOpenVersions } from '@/lib/jira/sync-version'

// J-6: automatic ticket sync, a timer inside the app process (started from
// instrumentation.ts). No revalidatePath — version pages are dynamic and polled.

export const DEFAULT_SYNC_INTERVAL_MINUTES = 30
const MAX_SYNC_INTERVAL_MINUTES = 24 * 60
const FIRST_RUN_DELAY_MS = 60_000
// Arbitrary constant key for pg_try_advisory_xact_lock — one auto-sync at a time,
// also across replicas / an overlapping container during a redeploy.
const LOCK_KEY = 731600106

export type SyncInterval =
  | { status: 'on'; minutes: number }
  | { status: 'off' }
  | { status: 'invalid'; raw: string }

// Unset/empty → default; "0" → off; integer 1..1440 → minutes; anything else → invalid (off).
export function readSyncInterval(
  raw: string | undefined = process.env.JIRA_SYNC_INTERVAL_MINUTES,
): SyncInterval {
  const v = raw?.trim() ?? ''
  if (v === '') return { status: 'on', minutes: DEFAULT_SYNC_INTERVAL_MINUTES }
  if (!/^\d+$/.test(v)) return { status: 'invalid', raw: v }
  const n = Number(v)
  if (n === 0) return { status: 'off' }
  if (n > MAX_SYNC_INTERVAL_MINUTES) return { status: 'invalid', raw: v }
  return { status: 'on', minutes: n }
}

export type AutoSyncRun = {
  finishedAt: Date
  versions: number
  failed: { name: string; message: string }[]
  skipped?: boolean // lock held by another run
}

type AutoSyncState = { timerStarted: boolean; running: boolean; lastRun: AutoSyncRun | null }

// globalThis: instrumentation and page bundles get separate module instances.
const g = globalThis as typeof globalThis & { __releaseHubAutoSync?: AutoSyncState }
function state(): AutoSyncState {
  g.__releaseHubAutoSync ??= { timerStarted: false, running: false, lastRun: null }
  return g.__releaseHubAutoSync
}

export function lastAutoSyncRun(): AutoSyncRun | null {
  return state().lastRun
}

export async function runAutoSyncOnce(): Promise<AutoSyncRun | null> {
  const s = state()
  if (s.running) return null
  const cfg = readJiraConfig()
  if (cfg.status !== 'configured') return null

  s.running = true
  try {
    const run = await prisma.$transaction(
      async (tx): Promise<AutoSyncRun> => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${LOCK_KEY}::bigint) AS locked`
        if (!locked) return { finishedAt: new Date(), versions: 0, failed: [], skipped: true }
        const results = await syncAllOpenVersions(cfg.config)
        return {
          finishedAt: new Date(),
          versions: results.length,
          failed: results.filter((r) => !r.ok).map(({ name, message }) => ({ name, message })),
        }
      },
      // The transaction only holds the lock; the sync writes in its own transactions.
      { timeout: 30 * 60_000, maxWait: 10_000 },
    )
    s.lastRun = run
    if (run.skipped) {
      console.log('Jira auto-sync skipped: another run holds the lock.')
    } else {
      console.log(`Jira auto-sync: ${run.versions} version(s), ${run.failed.length} failed.`)
      for (const f of run.failed) console.warn(`Jira auto-sync failed for ${f.name}: ${f.message}`)
    }
    return run
  } catch {
    // Never log the raw error — it could carry request details.
    console.error('Jira auto-sync run failed unexpectedly.')
    s.lastRun = {
      finishedAt: new Date(),
      versions: 0,
      failed: [{ name: '—', message: 'Nieoczekiwany błąd automatycznej synchronizacji.' }],
    }
    return s.lastRun
  } finally {
    s.running = false
  }
}

export function startAutoSync(): void {
  const s = state()
  if (s.timerStarted) return
  const interval = readSyncInterval()
  if (interval.status === 'invalid') {
    console.warn(
      `JIRA_SYNC_INTERVAL_MINUTES="${interval.raw}" is invalid (0 or 1–${MAX_SYNC_INTERVAL_MINUTES}); ` +
        'Jira auto-sync is off.',
    )
    return
  }
  if (interval.status === 'off') return
  if (readJiraConfig().status !== 'configured') return

  s.timerStarted = true
  console.log(`Jira auto-sync every ${interval.minutes} min.`)
  setTimeout(() => {
    void runAutoSyncOnce()
    setInterval(() => void runAutoSyncOnce(), interval.minutes * 60_000).unref()
  }, FIRST_RUN_DELAY_MS).unref()
}
