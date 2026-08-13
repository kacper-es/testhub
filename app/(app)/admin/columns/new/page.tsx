import { requireRolePage } from '@/lib/auth/authz'
import { createColumn } from '@/app/actions/columns'
import { ColumnForm } from '@/components/admin/ColumnForm'

export default async function NewColumnPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Nowy krok</h1>
      </div>
      <ColumnForm action={createColumn} submitLabel="Utwórz krok" />
    </main>
  )
}
