import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const PAGE_SIZE = 50

const ENTITY_LABEL: Record<string, string> = {
  InstanceTestRun: 'Instancja',
  VersionTask: 'Zadanie',
  Version: 'Wersja',
}

const FIELD_LABEL: Record<string, string> = {
  status: 'status',
  manualCounterCurrent: 'licznik: rozwiązane',
  manualCounterTotal: 'licznik: wszystkie',
  environmentRestored: 'środowisko odtworzone',
  dbScriptsInstalled: 'skrypty bazodanowe',
  backendUpdated: 'backend podbity',
  testsCompleted: 'testy wykonane',
  notes: 'notatki',
  application: 'aplikacja',
  name: 'nazwa',
  releaseDate: 'data wydania',
}

const fmt = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Warsaw',
})

function displayValue(v: string | null): string {
  if (v == null) return '—'
  if (v === 'true') return 'tak'
  if (v === 'false') return 'nie'
  return v
}

const input =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg'

type SearchParams = {
  versionId?: string
  userId?: string
  entityType?: string
  from?: string
  to?: string
  page?: string
}

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRolePage(['ADMIN'])
  const sp = await searchParams

  const page = Math.max(1, Number(sp.page) || 1)

  const where: Prisma.ChangeLogWhereInput = {}
  if (sp.versionId) where.versionId = sp.versionId
  if (sp.userId) where.userId = sp.userId
  if (
    sp.entityType === 'InstanceTestRun' ||
    sp.entityType === 'VersionTask' ||
    sp.entityType === 'Version'
  ) {
    where.entityType = sp.entityType
  }
  if (sp.from || sp.to) {
    where.createdAt = {}
    if (sp.from) where.createdAt.gte = new Date(`${sp.from}T00:00:00.000Z`)
    if (sp.to) where.createdAt.lte = new Date(`${sp.to}T23:59:59.999Z`)
  }

  const [total, entries, versions, users] = await Promise.all([
    prisma.changeLog.count({ where }),
    prisma.changeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    prisma.version.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const versionName = new Map(versions.map((v) => [v.id, v.name]))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Zbuduj querystring dla paginacji, zachowując aktywne filtry.
  function pageHref(p: number): string {
    const q = new URLSearchParams()
    if (sp.versionId) q.set('versionId', sp.versionId)
    if (sp.userId) q.set('userId', sp.userId)
    if (sp.entityType) q.set('entityType', sp.entityType)
    if (sp.from) q.set('from', sp.from)
    if (sp.to) q.set('to', sp.to)
    q.set('page', String(p))
    return `/admin/changelog?${q.toString()}`
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Log zmian</h1>
      </div>

      {/* Filtry — natywny formularz GET (bez klienta). */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Wersja</span>
          <select name="versionId" defaultValue={sp.versionId ?? ''} className={input}>
            <option value="">Wszystkie</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Użytkownik</span>
          <select name="userId" defaultValue={sp.userId ?? ''} className={input}>
            <option value="">Wszyscy</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Typ encji</span>
          <select
            name="entityType"
            defaultValue={sp.entityType ?? ''}
            className={input}
          >
            <option value="">Wszystkie</option>
            <option value="InstanceTestRun">Instancja</option>
            <option value="VersionTask">Zadanie</option>
            <option value="Version">Wersja</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Od</span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ''}
            className={`${input} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Do</span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ''}
            className={`${input} font-mono`}
          />
        </label>

        <Button type="submit" variant="secondary">
          Filtruj
        </Button>
        <Link href="/admin/changelog" className="text-sm text-muted underline">
          Wyczyść
        </Link>
      </form>

      <p className="text-sm text-muted">
        {total === 0
          ? 'Brak wpisów dla wybranych filtrów.'
          : `${total} wpisów · strona ${page} z ${totalPages}`}
      </p>

      {entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-semibold text-muted">Kiedy</th>
                <th className="px-3 py-2 font-semibold text-muted">Kto</th>
                <th className="px-3 py-2 font-semibold text-muted">Encja</th>
                <th className="px-3 py-2 font-semibold text-muted">Wersja</th>
                <th className="px-3 py-2 font-semibold text-muted">Pole</th>
                <th className="px-3 py-2 font-semibold text-muted">Zmiana</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted">
                    {fmt.format(e.createdAt)}
                  </td>
                  <td className="px-3 py-2">{e.user.name}</td>
                  <td className="px-3 py-2">
                    {ENTITY_LABEL[e.entityType] ?? e.entityType}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.versionId ? (versionName.get(e.versionId) ?? '—') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {FIELD_LABEL[e.field] ?? e.field}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {displayValue(e.oldValue)} → {displayValue(e.newValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)}>
              <Button variant="secondary" type="button">
                ← Poprzednia
              </Button>
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-xs text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)}>
              <Button variant="secondary" type="button">
                Następna →
              </Button>
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  )
}
