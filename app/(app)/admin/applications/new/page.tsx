import { requireRolePage } from '@/lib/auth/authz'
import { createApplication } from '@/app/actions/applications'
import { ApplicationForm } from '@/components/admin/ApplicationForm'

export default async function NewApplicationPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Nowa aplikacja</h1>
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
