import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { todayInWarsaw } from '@/lib/date'
import { NewVersionForm } from './new-version-form'

export default async function NewVersionPage() {
  // Tworzenie wersji: TESTER/ADMIN (PM → redirect na /).
  await requireRolePage(['TESTER', 'ADMIN'])
  const today = todayInWarsaw()
  const [apps, flows] = await Promise.all([
    prisma.application.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.columnTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
  ])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowa wersja</h1>
      </div>
      <NewVersionForm today={today} apps={apps} flows={flows} />
    </main>
  )
}
