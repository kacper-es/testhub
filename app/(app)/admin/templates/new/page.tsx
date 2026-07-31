import Link from 'next/link'
import { requireRolePage } from '@/lib/auth/authz'
import { createTaskTemplate } from '@/app/actions/task-templates'
import { TemplateForm } from '@/components/admin/TemplateForm'

export default async function NewTemplatePage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/templates" className="text-sm text-muted underline">
          ← Szablony zadań
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nowy szablon</h1>
      </div>
      <TemplateForm action={createTaskTemplate} submitLabel="Utwórz szablon" />
    </main>
  )
}
