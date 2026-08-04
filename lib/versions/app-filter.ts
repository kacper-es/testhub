import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Filtr wersji po aplikacji. Wartość z query: konkretne id | 'none' (bez
// aplikacji) | undefined/'all' (wszystkie).
export type FilterApp = {
  id: string
  name: string
  iconType: string | null
  iconUpdatedAt: Date | null
}

export function parseAppFilter(value: string | undefined): string {
  return value && value.length > 0 ? value : 'all'
}

// Dokłada warunek aplikacji do WHERE wersji.
export function appVersionWhere(filter: string): Prisma.VersionWhereInput {
  if (filter === 'all') return {}
  if (filter === 'none') return { applicationId: null }
  return { applicationId: filter }
}

// Chipy filtra = aktywne aplikacje ∪ aplikacje faktycznie użyte w tym widoku
// (żeby nieaktywna aplikacja z przypisaną wersją nadal miała chip). `hasNone`
// mówi, czy w widoku są wersje bez aplikacji (chip „Bez aplikacji").
export async function getFilterApps(
  scopeWhere: Prisma.VersionWhereInput,
): Promise<{ apps: FilterApp[]; hasNone: boolean }> {
  const used = await prisma.version.groupBy({
    by: ['applicationId'],
    where: scopeWhere,
  })
  const usedIds = used
    .map((u) => u.applicationId)
    .filter((v): v is string => v !== null)
  const hasNone = used.some((u) => u.applicationId === null)

  const apps = await prisma.application.findMany({
    where: { OR: [{ isActive: true }, { id: { in: usedIds } }] },
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, iconType: true, iconUpdatedAt: true },
  })

  return { apps, hasNone }
}
