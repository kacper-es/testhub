import Link from 'next/link'
import type { VersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'
import {
  cancelVersion,
  releaseVersion,
  reopenVersion,
} from '@/app/actions/versions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge, type BadgeStatus } from '@/components/ui/StatusBadge'

const STATUS: Record<VersionStatus, { label: string; badge: BadgeStatus }> = {
  IN_PROGRESS: { label: 'W przygotowaniu', badge: 'warn' },
  RELEASED: { label: 'Wydana', badge: 'pass' },
  CANCELLED: { label: 'Anulowana', badge: 'fail' },
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function VersionsPage() {
  const user = await requireUser()
  const canEdit = user.role === 'TESTER' || user.role === 'ADMIN'
  const isAdmin = user.role === 'ADMIN'

  const versions = await prisma.version.findMany({
    orderBy: [{ status: 'asc' }, { releaseDate: 'asc' }],
    include: { _count: { select: { tasks: true, testRuns: true } } },
  })

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-muted underline">
            ← Start
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Wersje</h1>
        </div>
        {canEdit && (
          <Link href="/versions/new">
            <Button variant="primary">Nowa wersja</Button>
          </Link>
        )}
      </header>

      {versions.length === 0 ? (
        <p className="text-muted">
          Brak wersji w przygotowaniu — dodaj pierwszą.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v) => {
            const s = STATUS[v.status]
            return (
              <Card key={v.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg">{v.name}</span>
                    <StatusBadge status={s.badge}>{s.label}</StatusBadge>
                  </div>
                  <span className="font-mono text-sm text-muted">
                    {fmtDate(v.releaseDate)}
                  </span>
                </div>

                <div className="font-mono text-xs text-muted">
                  {v._count.tasks} zadań · {v._count.testRuns} instancji
                </div>

                {v.status === 'CANCELLED' && v.cancelReason && (
                  <p className="text-sm text-fail-strong">
                    Anulowano: {v.cancelReason}
                  </p>
                )}

                {canEdit && v.status === 'IN_PROGRESS' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={releaseVersion}>
                      <input type="hidden" name="versionId" value={v.id} />
                      <Button variant="secondary" type="submit">
                        Oznacz jako wydaną
                      </Button>
                    </form>

                    <details>
                      <summary className="inline-flex cursor-pointer select-none rounded-md border border-fail-strong px-3 py-2 text-sm font-medium text-fail-strong">
                        Anuluj…
                      </summary>
                      <form
                        action={cancelVersion}
                        className="mt-2 flex flex-col gap-2"
                      >
                        <input type="hidden" name="versionId" value={v.id} />
                        <input
                          name="reason"
                          required
                          placeholder="Powód anulowania"
                          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
                        />
                        <div>
                          <Button variant="danger" type="submit">
                            Potwierdź anulowanie
                          </Button>
                        </div>
                      </form>
                    </details>
                  </div>
                )}

                {isAdmin && v.status !== 'IN_PROGRESS' && (
                  <form action={reopenVersion}>
                    <input type="hidden" name="versionId" value={v.id} />
                    <Button variant="ghost" type="submit">
                      Otwórz ponownie
                    </Button>
                  </form>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
