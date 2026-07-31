import Link from 'next/link'
import { requireRolePage } from '@/lib/auth/authz'
import { createInstance } from '@/app/actions/instances'
import { InstanceForm } from '@/components/instances/InstanceForm'

export default async function NewInstancePage() {
  await requireRolePage(['TESTER', 'ADMIN'])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link href="/instances" className="text-sm text-muted underline">
          ← Katalog instancji
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nowa instancja</h1>
      </div>
      <InstanceForm action={createInstance} submitLabel="Utwórz instancję" />
    </main>
  )
}
