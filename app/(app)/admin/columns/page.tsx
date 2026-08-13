import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import {
  setColumnTemplateActive,
  setDefaultColumnTemplate,
} from '@/app/actions/columns'
import { FIELD_TYPE_LABEL } from '@/components/admin/ColumnForm'
import { ColumnCatalogList } from '@/components/admin/ColumnCatalogList'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

type Tab = 'steps' | 'flows'

function TabLink({ tab, current, children }: { tab: Tab; current: Tab; children: React.ReactNode }) {
  const href = tab === 'steps' ? '/admin/columns' : '/admin/columns?tab=flows'
  const active = tab === current
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-raised hover:text-fg',
      )}
    >
      {children}
    </Link>
  )
}

export default async function ColumnsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireRolePage(['ADMIN'])
  const { tab } = await searchParams
  const current: Tab = tab === 'flows' ? 'flows' : 'steps'

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Konfiguracja kroków i szablony</h1>
        <p className="mt-1 text-sm text-muted">
          Kroki to konfigurowalne kolumny w tabeli instancji. Szablony (flow)
          grupują kroki i podpinają się do nowych wersji.
        </p>
      </div>

      <nav className="flex gap-2 border-b border-border pb-3">
        <TabLink tab="steps" current={current}>
          Kroki
        </TabLink>
        <TabLink tab="flows" current={current}>
          Szablony
        </TabLink>
      </nav>

      {current === 'steps' ? <StepsTab /> : <FlowsTab />}
    </main>
  )
}

async function StepsTab() {
  const columns = await prisma.column.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  const toItem = (c: (typeof columns)[number]) => ({
    id: c.id,
    name: c.name,
    typeLabel: FIELD_TYPE_LABEL[c.fieldType],
  })
  const active = columns.filter((c) => c.isActive).map(toItem)
  const inactive = columns.filter((c) => !c.isActive).map(toItem)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Przeciągnij <span aria-hidden>⠿</span>, by zmienić kolejność kroków.
        </p>
        <Link href="/admin/columns/new">
          <Button variant="primary">Nowy krok</Button>
        </Link>
      </div>

      {columns.length === 0 ? (
        <p className="text-muted">Brak kroków — dodaj pierwszy.</p>
      ) : (
        <ColumnCatalogList active={active} inactive={inactive} />
      )}
    </section>
  )
}

async function FlowsTab() {
  const templates = await prisma.columnTemplate.findMany({
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true } } },
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link href="/admin/columns/flows/new">
          <Button variant="primary">Nowy szablon</Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-muted">Brak szablonów — dodaj pierwszy.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-muted">{t.sortOrder}</span>
                <span className="font-medium text-fg">{t.name}</span>
                {t.isDefault && <StatusBadge status="pass">Domyślny</StatusBadge>}
                <span className="text-sm text-muted">{t._count.items} kroków</span>
                {!t.isActive && <StatusBadge status="neutral">Nieaktywny</StatusBadge>}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/columns/flows/${t.id}/edit`}>
                  <Button variant="secondary" type="button">
                    Edytuj
                  </Button>
                </Link>
                {!t.isDefault && t.isActive && (
                  <form action={setDefaultColumnTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button variant="secondary" type="submit">
                      Ustaw domyślny
                    </Button>
                  </form>
                )}
                <form action={setColumnTemplateActive}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="active" value={t.isActive ? 'false' : 'true'} />
                  <Button variant={t.isActive ? 'ghost' : 'secondary'} type="submit">
                    {t.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
