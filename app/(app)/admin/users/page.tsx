import Link from 'next/link'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/authz'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

const ROLE_LABEL: Record<Role, string> = {
  TESTER: 'Tester',
  PM: 'PM (read-only)',
  ADMIN: 'Administrator',
}

export default async function UsersPage() {
  const admin = await requireRolePage(['ADMIN'])

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Konta</h1>
        </div>
        <Link href="/admin/users/new">
          <Button variant="primary">Nowe konto</Button>
        </Link>
      </header>

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-fg">{u.name}</span>
                {u.id === admin.id && (
                  <span className="text-xs text-muted">(Ty)</span>
                )}
                <StatusBadge status="neutral">{ROLE_LABEL[u.role]}</StatusBadge>
                {u.isActive ? (
                  <StatusBadge status="pass">Aktywne</StatusBadge>
                ) : (
                  <StatusBadge status="fail">Nieaktywne</StatusBadge>
                )}
                {u.mustChangePassword && (
                  <StatusBadge status="warn">Hasło tymczasowe</StatusBadge>
                )}
              </div>
              <span className="font-mono text-xs text-muted">{u.email}</span>
            </div>
            <Link href={`/admin/users/${u.id}`}>
              <Button variant="secondary" type="button">
                Zarządzaj
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </main>
  )
}
