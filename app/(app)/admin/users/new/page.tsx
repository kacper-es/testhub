import { requireRolePage } from '@/lib/auth/authz'
import { CreateUserForm } from '@/components/admin/CreateUserForm'

export default async function NewUserPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nowe konto</h1>
      </div>
      <CreateUserForm />
    </main>
  )
}
