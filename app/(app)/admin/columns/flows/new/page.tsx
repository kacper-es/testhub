import { requireRolePage } from '@/lib/auth/authz'
import { prisma } from '@/lib/prisma'
import { createColumnTemplate } from '@/app/actions/columns'
import { ColumnTemplateForm } from '@/components/admin/ColumnTemplateForm'

export default async function NewColumnTemplatePage() {
  await requireRolePage(['ADMIN'])

  const columns = await prisma.column.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowy szablon</h1>
      </div>
      <ColumnTemplateForm
        action={createColumnTemplate}
        submitLabel="Utwórz szablon"
        columns={columns}
      />
    </main>
  )
}
