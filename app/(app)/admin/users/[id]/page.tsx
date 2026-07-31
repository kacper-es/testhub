import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { setUserActive, setUserRole } from '@/app/actions/users'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ResetPasswordForm } from '@/components/admin/ResetPasswordForm'

const ROLES: { value: Role; label: string }[] = [
  { value: 'TESTER', label: 'Tester' },
  { value: 'PM', label: 'Product Manager (read-only)' },
  { value: 'ADMIN', label: 'Administrator' },
]

const input =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg'

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const admin = await requireRolePage(['ADMIN'])
  const { id } = await params

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) notFound()
  const isSelf = user.id === admin.id

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted underline">
          ← Konta
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{user.name}</h1>
        <p className="font-mono text-sm text-muted">{user.email}</p>
        <div className="mt-2 flex gap-2">
          {user.isActive ? (
            <StatusBadge status="pass">Aktywne</StatusBadge>
          ) : (
            <StatusBadge status="fail">Nieaktywne</StatusBadge>
          )}
          {user.mustChangePassword && (
            <StatusBadge status="warn">Hasło tymczasowe</StatusBadge>
          )}
        </div>
      </div>

      {isSelf && (
        <p className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
          To Twoje konto. Rolę i aktywność może zmienić inny administrator —
          zapobiega to przypadkowemu odcięciu sobie dostępu.
        </p>
      )}

      {!isSelf && (
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Rola</h2>
          <form action={setUserRole} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={user.id} />
            <select name="role" defaultValue={user.role} className={input}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button variant="secondary" type="submit">
              Zmień rolę
            </Button>
          </form>

          <h2 className="font-semibold">Aktywność</h2>
          <form action={setUserActive}>
            <input type="hidden" name="id" value={user.id} />
            <input
              type="hidden"
              name="active"
              value={user.isActive ? 'false' : 'true'}
            />
            <Button
              variant={user.isActive ? 'danger' : 'secondary'}
              type="submit"
            >
              {user.isActive ? 'Dezaktywuj konto' : 'Aktywuj konto'}
            </Button>
          </form>
          {user.isActive && (
            <p className="text-xs text-muted">
              Dezaktywacja usuwa wszystkie sesje użytkownika.
            </p>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Reset hasła</h2>
        <ResetPasswordForm userId={user.id} />
      </Card>
    </main>
  )
}
