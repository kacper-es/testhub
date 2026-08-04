import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { setApplicationActive } from '@/app/actions/applications'
import { AppIcon } from '@/components/versions/AppIcon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default async function ApplicationsPage() {
  await requireRolePage(['ADMIN'])

  const apps = await prisma.application.findMany({
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      iconType: true,
      iconUpdatedAt: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { versions: true } },
    },
  })

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-muted underline">
            ← Panel administratora
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Aplikacje</h1>
        </div>
        <Link href="/admin/applications/new">
          <Button variant="primary">Nowa aplikacja</Button>
        </Link>
      </header>

      {apps.length === 0 ? (
        <p className="text-muted">Brak aplikacji — dodaj pierwszą.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((a) => (
            <Card key={a.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">
                    {a.iconType ? (
                      <AppIcon app={a} />
                    ) : (
                      <span className="inline-block h-[1em] w-[1em] rounded-sm border border-dashed border-border" />
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    #{a.sortOrder}
                  </span>
                  <span className="font-medium text-fg">{a.name}</span>
                  {!a.isActive && (
                    <StatusBadge status="fail">Nieaktywna</StatusBadge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted">
                  {a._count.versions} wersji
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/applications/${a.id}/edit`}>
                  <Button variant="secondary" type="button">
                    Edytuj
                  </Button>
                </Link>
                <form action={setApplicationActive}>
                  <input type="hidden" name="id" value={a.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={a.isActive ? 'false' : 'true'}
                  />
                  <Button
                    variant={a.isActive ? 'ghost' : 'secondary'}
                    type="submit"
                  >
                    {a.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
