import type { Prisma } from '@prisma/client'
import type { JiraIssueData } from '@/lib/jira/issues'

// Zapis wyniku pełnej synchronizacji jednej wersji (J-3), wołany w transakcji:
// zwrócone tickety → upsert (removedAt = null), pozostałe tickety wersji →
// removedAt = now (zniknęły z fixVersion; zero hard delete), Version.jiraSyncedAt.

export type SyncSummary = { total: number; done: number; removed: number }

export async function applyIssueSync(
  tx: Prisma.TransactionClient,
  versionId: string,
  issues: JiraIssueData[],
  now: Date,
): Promise<SyncSummary> {
  for (const issue of issues) {
    await tx.jiraIssue.upsert({
      where: { versionId_jiraId: { versionId, jiraId: issue.jiraId } },
      create: { ...issue, versionId, syncedAt: now },
      update: { ...issue, syncedAt: now, removedAt: null },
    })
  }

  const removed = await tx.jiraIssue.updateMany({
    where: {
      versionId,
      removedAt: null,
      jiraId: { notIn: issues.map((i) => i.jiraId) },
    },
    data: { removedAt: now },
  })

  await tx.version.update({ where: { id: versionId }, data: { jiraSyncedAt: now } })

  return {
    total: issues.length,
    done: issues.filter((i) => i.statusCategory === 'done').length,
    removed: removed.count,
  }
}
