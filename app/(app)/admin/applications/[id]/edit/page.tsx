import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import {
  removeApplicationIcon,
  updateApplication,
} from '@/app/actions/applications'
import { ApplicationForm } from '@/components/admin/ApplicationForm'
import { IconUploadForm } from '@/components/admin/IconUploadForm'
import { AppIcon } from '@/components/versions/AppIcon'
import { Button } from '@/components/ui/Button'

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage(['ADMIN'])
  const { id } = await params

  const app = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      iconType: true,
      iconUpdatedAt: true,
    },
  })
  if (!app) notFound()

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <Link
          href="/admin/applications"
          className="text-sm text-muted underline"
        >
          ← Aplikacje
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edytuj aplikację</h1>
      </div>

      <ApplicationForm
        action={updateApplication}
        submitLabel="Zapisz zmiany"
        initialValues={{
          id: app.id,
          name: app.name,
          sortOrder: app.sortOrder,
        }}
      />

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Ikona</h2>

        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">
            {app.iconType ? (
              <AppIcon app={app} />
            ) : (
              <span className="inline-block h-[1em] w-[1em] rounded-sm border border-dashed border-border" />
            )}
          </span>
          <span className="text-sm text-muted">
            {app.iconType ? 'Aktualna ikona' : 'Brak ikony'}
          </span>
        </div>

        <IconUploadForm id={app.id} />

        {app.iconType && (
          <form action={removeApplicationIcon}>
            <input type="hidden" name="id" value={app.id} />
            <Button variant="ghost" type="submit">
              Usuń ikonę
            </Button>
          </form>
        )}
      </section>
    </main>
  )
}
