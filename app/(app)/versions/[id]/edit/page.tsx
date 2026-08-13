import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { todayInWarsaw } from '@/lib/date'
import { toDateOnly } from '@/lib/versions/deadline'
import {
  addVersionColumns,
  restoreVersionColumn,
} from '@/app/actions/version-columns'
import { unpinInstanceRun } from '@/app/actions/test-runs'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { VersionColumnsList } from '@/components/versions/VersionColumnsList'
import {
  AttachInstance,
  type AttachOption,
} from '@/components/versions/AttachInstance'
import { EditVersionForm } from './edit-version-form'

export default async function EditVersionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Edycja wersji: TESTER/ADMIN (PM → redirect na /).
  await requireRolePage(['TESTER', 'ADMIN'])
  const { id } = await params

  const version = await prisma.version.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      releaseDate: true,
      status: true,
      applicationId: true,
      application: { select: { id: true, name: true, isActive: true } },
    },
  })
  if (!version) notFound()

  // Edycja tylko na otwartej wersji (read-only na zamkniętej, reguła 12).
  if (version.status !== 'IN_PROGRESS') redirect(`/versions/${id}`)

  const today = todayInWarsaw()
  const activeApps = await prisma.application.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  // Bieżąca aplikacja nieaktywna — dołącz ją, by nie zniknęła z selecta.
  const apps =
    version.application && !version.application.isActive
      ? [
          ...activeApps,
          {
            id: version.application.id,
            name: `${version.application.name} (nieaktywna)`,
          },
        ]
      : activeApps

  // Kroki (kolumny) wersji: aktywne + ukryte (do przywrócenia) + katalog do dołożenia.
  const allVersionColumns = await prisma.versionColumn.findMany({
    where: { versionId: id },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, columnId: true, excludedAt: true },
  })
  const versionColumns = allVersionColumns.filter((c) => c.excludedAt === null)
  const hiddenColumns = allVersionColumns.filter((c) => c.excludedAt !== null)
  const usedColumnIds = new Set(
    versionColumns.map((c) => c.columnId).filter((v): v is string => v !== null),
  )
  // Nazwy wszystkich kroków wersji (aktywnych i ukrytych) — krok ukryty przywraca
  // się przyciskiem „Przywróć", nie dubluje w „dodaj z katalogu".
  const usedNames = new Set(allVersionColumns.map((c) => c.name))
  const catalog = await prisma.column.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })
  // Wyklucz kroki już aktywne — po id proweniencji i po nazwie (kroki backfillowane
  // mają columnId = null, więc chronimy też przed duplikatem nazwy).
  const available = catalog.filter(
    (c) => !usedColumnIds.has(c.id) && !usedNames.has(c.name),
  )

  // Instancje wersji: aktywne runy (do odpięcia) + opcje podpięcia (reguła 20).
  const testRuns = await prisma.instanceTestRun.findMany({
    where: { versionId: id },
    include: { instance: { select: { name: true } } },
    orderBy: { instance: { name: 'asc' } },
  })
  const activeRuns = testRuns.filter((r) => r.excludedAt === null)
  const runByInstanceId = new Map(testRuns.map((r) => [r.instanceId, r]))
  const activeInstances = await prisma.instance.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  const attachOptions: AttachOption[] = activeInstances
    .filter((i) => {
      const r = runByInstanceId.get(i.id)
      return !r || r.excludedAt !== null
    })
    .map((i) => ({ id: i.id, name: i.name, hadData: runByInstanceId.has(i.id) }))

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edytuj wersję</h1>
        <p className="mt-1 font-mono text-sm text-muted">{version.name}</p>
      </div>
      <EditVersionForm
        versionId={version.id}
        today={today}
        initialName={version.name}
        initialDate={toDateOnly(version.releaseDate)}
        initialAppId={version.applicationId ?? ''}
        apps={apps}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Kroki wersji</h2>
          <p className="mt-1 text-sm text-muted">
            Kolumny tabeli instancji dla tej wersji. Usunięcie chowa krok
            (dane zaznaczeń zostają i wrócą po ponownym dodaniu).
          </p>
        </div>

        <VersionColumnsList
          versionId={version.id}
          columns={versionColumns.map((c) => ({ id: c.id, name: c.name }))}
        />

        {hiddenColumns.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted">Ukryte kroki</span>
            {hiddenColumns.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-muted">{c.name}</span>
                <form action={restoreVersionColumn}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button variant="ghost" type="submit">
                    Przywróć
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        )}

        {available.length > 0 && (
          <form
            action={addVersionColumns}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <input type="hidden" name="versionId" value={version.id} />
            <span className="text-sm font-medium">Dodaj kroki z katalogu</span>
            <div className="flex flex-col gap-2">
              {available.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="columnIds" value={c.id} />
                  {c.name}
                </label>
              ))}
            </div>
            <div>
              <Button type="submit" variant="secondary">
                Dodaj zaznaczone
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Instancje</h2>
          <p className="mt-1 text-sm text-muted">
            Instancje podpięte do tej wersji. Odpięcie chowa instancję (dane
            zaznaczeń zostają i wrócą po ponownym podpięciu).
          </p>
        </div>

        {activeRuns.length === 0 ? (
          <p className="text-sm text-muted">Brak podpiętych instancji.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeRuns.map((r) => (
              <li key={r.id}>
                <Card className="flex items-center justify-between gap-3 py-2">
                  <span className="text-fg">{r.instance.name}</span>
                  <form action={unpinInstanceRun}>
                    <input type="hidden" name="runId" value={r.id} />
                    <Button variant="ghost" type="submit" className="text-fail-strong">
                      Odepnij
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <AttachInstance versionId={version.id} options={attachOptions} />
      </section>
    </main>
  )
}
