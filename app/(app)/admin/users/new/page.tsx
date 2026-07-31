import Link from 'next/link'
import { requireRolePage } from '@/lib/auth/authz'
import { CreateUserForm } from '@/components/admin/CreateUserForm'

export default async function NewUserPage() {
  await requireRolePage(['ADMIN'])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted underline">
          ← Konta
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nowe konto</h1>
      </div>
      <CreateUserForm />
    </main>
  )
}
