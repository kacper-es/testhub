import { prisma } from '@/lib/prisma'
import type { JiraConfig } from '@/lib/jira/config'
import { JiraError } from '@/lib/jira/client'
import { fetchFixVersionIssues, TooManyIssuesError } from '@/lib/jira/issues'
import { applyIssueSync } from '@/lib/jira/sync'

// Shared by the manual sync actions (J-3) and the scheduler (J-6).

export class SyncAbortedError extends Error {}

export type SyncSummary = { total: number; done: number; removed: number }
export type SyncResult = { versionId: string; name: string; ok: boolean; message: string }

// Full sync of one version: fetch everything from Jira first (outside a
// transaction), then write in one transaction. A fetch error = zero changes.
export async function syncOneVersion(versionId: string, config: JiraConfig): Promise<SyncSummary> {
  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { status: true, jiraVersionId: true },
  })
  if (!version) throw new SyncAbortedError('Nie znaleziono wersji.')
  if (version.status !== 'IN_PROGRESS') {
    throw new SyncAbortedError('Wersja jest zamknięta — synchronizacja tylko dla otwartych.')
  }
  if (!version.jiraVersionId) {
    throw new SyncAbortedError('Wersja nie jest podpięta do wersji Jira.')
  }
  const jiraVersionId = version.jiraVersionId

  const issues = await fetchFixVersionIssues(config, jiraVersionId)

  return prisma.$transaction(async (tx) => {
    // Re-read — the version may have been closed or re-mapped while fetching.
    const current = await tx.version.findUnique({
      where: { id: versionId },
      select: { status: true, jiraVersionId: true },
    })
    if (!current || current.status !== 'IN_PROGRESS' || current.jiraVersionId !== jiraVersionId) {
      throw new SyncAbortedError('Wersja zmieniła się w trakcie synchronizacji — spróbuj ponownie.')
    }
    return applyIssueSync(tx, versionId, issues, new Date())
  })
}

// User-facing message; never contains secrets (JiraError messages are sanitized).
export function syncErrorMessage(err: unknown): string {
  if (
    err instanceof SyncAbortedError ||
    err instanceof TooManyIssuesError ||
    err instanceof JiraError
  ) {
    return err.message
  }
  console.error('Jira request failed with unexpected error')
  return 'Nieoczekiwany błąd podczas łączenia z Jirą.'
}

export function syncSummaryText(s: SyncSummary): string {
  const base = `${s.total} ticketów, ${s.done} gotowych`
  return s.removed > 0 ? `${base}, ${s.removed} wyjętych z wersji` : base
}

// All open versions mapped to Jira, one by one; one failure does not stop the rest.
export async function syncAllOpenVersions(config: JiraConfig): Promise<SyncResult[]> {
  const versions = await prisma.version.findMany({
    where: { status: 'IN_PROGRESS', jiraVersionId: { not: null } },
    orderBy: { releaseDate: 'asc' },
    select: { id: true, name: true },
  })
  const results: SyncResult[] = []
  for (const v of versions) {
    try {
      const s = await syncOneVersion(v.id, config)
      results.push({ versionId: v.id, name: v.name, ok: true, message: syncSummaryText(s) })
    } catch (err) {
      results.push({ versionId: v.id, name: v.name, ok: false, message: syncErrorMessage(err) })
    }
  }
  return results
}
