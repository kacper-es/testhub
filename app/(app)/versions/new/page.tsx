import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { todayInWarsaw } from '@/lib/date'
import { NewVersionForm } from './new-version-form'

export default async function NewVersionPage() {
  // Tworzenie wersji: TESTER/ADMIN (PM → redirect na /).
  await requireRolePage(['TESTER', 'ADMIN'])
  const today = todayInWarsaw()
  const apps = await prisma.application.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link href="/versions" className="text-sm text-muted underline">
          ← Wersje
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nowa wersja</h1>
      </div>
      <NewVersionForm today={today} apps={apps} />
    </main>
  )
}
