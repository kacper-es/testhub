import Link from 'next/link'
import type { User } from '@prisma/client'
import { logout } from '@/app/actions/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { AppNav } from '@/components/nav/AppNav'

// Wspólny pasek zalogowanej części aplikacji. Sticky, na każdej stronie grupy (app).
// Marka po lewej jest linkiem do dashboardu (przycisk „home"), po prawej — tożsamość,
// przełącznik motywu i wylogowanie (dostępne wszędzie, nie tylko na dashboardzie).
export function AppHeader({
  user,
}: {
  user: Pick<User, 'name' | 'role' | 'theme'>
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/"
            aria-label="Strona główna"
            className="flex items-center gap-2 rounded-md"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg font-mono text-sm font-bold text-bg"
            >
              RH
            </span>
            <span className="text-base font-semibold">Release Hub</span>
          </Link>
          <AppNav isAdmin={user.role === 'ADMIN'} />
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle current={user.theme} />
          <span className="hidden text-sm text-muted sm:inline">
            {user.name}{' '}
            <span className="font-mono text-xs">({user.role})</span>
          </span>
          <form action={logout}>
            <Button variant="secondary" type="submit">
              Wyloguj
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
