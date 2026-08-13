import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { updateColumn } from '@/app/actions/columns'
import { ColumnForm } from '@/components/admin/ColumnForm'

export default async function EditColumnPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage(['ADMIN'])
  const { id } = await params

  const column = await prisma.column.findUnique({ where: { id } })
  if (!column) notFound()

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edytuj krok</h1>
      </div>
      <ColumnForm
        action={updateColumn}
        submitLabel="Zapisz zmiany"
        initialValues={{
          id: column.id,
          name: column.name,
          fieldType: column.fieldType,
        }}
      />
    </main>
  )
}
