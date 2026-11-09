import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { updateInstance } from '@/app/actions/instances'
import { InstanceForm } from '@/components/instances/InstanceForm'

export default async function EditInstancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage(['ADMIN'])
  const { id } = await params

  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) notFound()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edytuj instancję</h1>
      </div>
      <InstanceForm
        action={updateInstance}
        submitLabel="Zapisz zmiany"
        initialValues={{
          id: instance.id,
          name: instance.name,
          clientName: instance.clientName,
          keyFunctionalities: instance.keyFunctionalities,
        }}
      />
    </main>
  )
}
