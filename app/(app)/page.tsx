import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function HomePage() {
  // Gwarantowane przez layout (app).
  const user = await getSessionUser()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Release Hub</h1>
        <div className="flex items-center gap-3">
          {user && <ThemeToggle current={user.theme} />}
          <form action={logout}>
            <Button variant="secondary" type="submit">
              Wyloguj
            </Button>
          </form>
        </div>
      </header>

      <p>
        Zalogowano jako <strong>{user?.name}</strong> (
        <span className="font-mono">{user?.role}</span>).
      </p>

      <p className="text-sm text-muted">
        <Link className="underline" href="/design">
          Galeria komponentów →
        </Link>
      </p>
    </main>
  )
}
