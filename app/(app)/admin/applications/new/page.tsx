import { requireRolePage } from '@/lib/auth/authz'
import { createApplication } from '@/app/actions/applications'
import { ApplicationForm } from '@/components/admin/ApplicationForm'

export default async function NewApplicationPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowa aplikacja</h1>
        <p className="mt-1 text-sm text-muted">
          Ikonę dodasz po utworzeniu, na ekranie edycji.
        </p>
      </div>
      <ApplicationForm
        action={createApplication}
        submitLabel="Utwórz aplikację"
      />
    </main>
  )
}
