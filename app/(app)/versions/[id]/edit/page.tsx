import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { todayInWarsaw } from '@/lib/date'
import { toDateOnly } from '@/lib/versions/deadline'
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
    </main>
  )
}
