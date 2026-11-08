import { prisma } from '@/lib/prisma'
import type { JiraCounts } from '@/lib/versions/ticket-source'

// Liczby ticketów z lokalnej kopii (J-4): bez wyjętych z wersji (removedAt).
// Jedno zapytanie dla wielu wersji (dashboard).
export async function jiraCountsByVersion(versionIds: string[]): Promise<Map<string, JiraCounts>> {
  const out = new Map<string, JiraCounts>()
  if (versionIds.length === 0) return out

  const rows = await prisma.jiraIssue.groupBy({
    by: ['versionId', 'statusCategory'],
    where: { versionId: { in: versionIds }, removedAt: null },
    _count: { _all: true },
  })
  for (const r of rows) {
    const c = out.get(r.versionId) ?? { done: 0, total: 0 }
    c.total += r._count._all
    if (r.statusCategory === 'done') c.done += r._count._all
    out.set(r.versionId, c)
  }
  return out
}
