import { requireRolePage } from '@/lib/auth/authz'
import { CreateUserForm } from '@/components/admin/CreateUserForm'

export default async function NewUserPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Nowe konto</h1>
      </div>
      <CreateUserForm />
    </main>
  )
}
