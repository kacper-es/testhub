import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { updateColumnTemplate } from '@/app/actions/columns'
import { ColumnTemplateForm } from '@/components/admin/ColumnTemplateForm'

export default async function EditColumnTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage(['ADMIN'])
  const { id } = await params

  const template = await prisma.columnTemplate.findUnique({
    where: { id },
    include: {
      items: { select: { columnId: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!template) notFound()

  const selectedIds = template.items.map((i) => i.columnId)

  // Aktywne kroki + ewentualne nieaktywne, które są już w szablonie (by nie znikły).
  const columns = await prisma.column.findMany({
    where: { OR: [{ isActive: true }, { id: { in: selectedIds } }] },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edytuj szablon</h1>
      </div>
      <ColumnTemplateForm
        action={updateColumnTemplate}
        submitLabel="Zapisz zmiany"
        columns={columns}
        initialValues={{
          id: template.id,
          name: template.name,
          isDefault: template.isDefault,
          sortOrder: template.sortOrder,
          selectedIds,
        }}
      />
    </main>
  )
}
