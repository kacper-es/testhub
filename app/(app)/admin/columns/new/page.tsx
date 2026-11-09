import { requireRolePage } from '@/lib/auth/authz'
import { createColumn } from '@/app/actions/columns'
import { ColumnForm } from '@/components/admin/ColumnForm'

export default async function NewColumnPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowy krok</h1>
      </div>
      <ColumnForm action={createColumn} submitLabel="Utwórz krok" />
    </main>
  )
}
