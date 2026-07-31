import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { updateTaskTemplate } from '@/app/actions/task-templates'
import { TemplateForm } from '@/components/admin/TemplateForm'

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage(['ADMIN'])
  const { id } = await params

  const template = await prisma.taskTemplate.findUnique({ where: { id } })
  if (!template) notFound()

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/templates" className="text-sm text-muted underline">
          ← Szablony zadań
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edytuj szablon</h1>
      </div>
      <TemplateForm
        action={updateTaskTemplate}
        submitLabel="Zapisz zmiany"
        lockedTaskType={template.taskType}
        initialValues={{
          id: template.id,
          name: template.name,
          description: template.description,
          taskType: template.taskType,
          deadlineType: template.deadlineType,
          daysBeforeRelease: template.daysBeforeRelease,
          sortOrder: template.sortOrder,
        }}
      />
    </main>
  )
}
