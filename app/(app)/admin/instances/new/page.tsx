import { requireRolePage } from '@/lib/auth/authz'
import { createInstance } from '@/app/actions/instances'
import { InstanceForm } from '@/components/instances/InstanceForm'

export default async function NewInstancePage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowa instancja</h1>
      </div>
      <InstanceForm action={createInstance} submitLabel="Utwórz instancję" />
    </main>
  )
}
