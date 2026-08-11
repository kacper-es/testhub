import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { setInstanceActive } from '@/app/actions/instances'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default async function InstancesPage() {
  await requireRolePage(['ADMIN'])

  const instances = await prisma.instance.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { testRuns: true } } },
  })

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Katalog instancji</h1>
        </div>
        <Link href="/admin/instances/new">
          <Button variant="primary">Nowa instancja</Button>
        </Link>
      </header>

      {instances.length === 0 ? (
        <p className="text-muted">
          Brak instancji — dodaj pierwszą lub zaimportuj z CSV.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {instances.map((i) => (
            <Card key={i.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-fg">{i.name}</span>
                  {i.clientName && (
                    <span className="text-sm text-muted">{i.clientName}</span>
                  )}
                  {!i.isActive && (
                    <StatusBadge status="neutral">Nieaktywna</StatusBadge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted">
                  {i._count.testRuns} przypisań
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm text-muted">
                {i.keyFunctionalities}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/instances/${i.id}/edit`}>
                  <Button variant="secondary" type="button">
                    Edytuj
                  </Button>
                </Link>
                <form action={setInstanceActive}>
                  <input type="hidden" name="id" value={i.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={i.isActive ? 'false' : 'true'}
                  />
                  <Button
                    variant={i.isActive ? 'ghost' : 'secondary'}
                    type="submit"
                  >
                    {i.isActive ? 'Dezaktywuj' : 'Aktywuj'}
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
