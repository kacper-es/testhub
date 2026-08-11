import Link from 'next/link'
import type { TaskType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { setTaskTemplateActive } from '@/app/actions/task-templates'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  CHECKBOX: 'Checkbox',
  TICKET_AGGREGATE: 'Licznik ticketów',
  INSTANCE_AGGREGATE: 'Agregat instancji',
}

export default async function TemplatesPage() {
  await requireRolePage(['ADMIN'])

  const templates = await prisma.taskTemplate.findMany({
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
  })

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Szablony zadań</h1>
        </div>
        <Link href="/admin/templates/new">
          <Button variant="primary">Nowy szablon</Button>
        </Link>
      </header>

      {templates.length === 0 ? (
        <p className="text-muted">Brak szablonów — dodaj pierwszy.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-muted">
                    #{t.sortOrder}
                  </span>
                  <span className="font-medium text-fg">{t.name}</span>
                  <StatusBadge status="neutral">
                    {TASK_TYPE_LABEL[t.taskType]}
                  </StatusBadge>
                  {!t.isActive && (
                    <StatusBadge status="fail">Nieaktywny</StatusBadge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted">
                  {t.deadlineType === 'DAYS_BEFORE_RELEASE' &&
                  t.daysBeforeRelease != null
                    ? `${t.daysBeforeRelease} dni przed`
                    : 'elastyczny'}
                </span>
              </div>

              {t.description && (
                <p className="text-sm text-muted">{t.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/templates/${t.id}/edit`}>
                  <Button variant="secondary" type="button">
                    Edytuj
                  </Button>
                </Link>
                <form action={setTaskTemplateActive}>
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={t.isActive ? 'false' : 'true'}
                  />
                  <Button
                    variant={t.isActive ? 'ghost' : 'secondary'}
                    type="submit"
                  >
                    {t.isActive ? 'Dezaktywuj' : 'Aktywuj'}
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
