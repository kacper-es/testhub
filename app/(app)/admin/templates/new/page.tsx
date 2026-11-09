import { requireRolePage } from '@/lib/auth/authz'
import { createTaskTemplate } from '@/app/actions/task-templates'
import { TemplateForm } from '@/components/admin/TemplateForm'

export default async function NewTemplatePage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowy szablon</h1>
      </div>
      <TemplateForm action={createTaskTemplate} submitLabel="Utwórz szablon" />
    </main>
  )
}
