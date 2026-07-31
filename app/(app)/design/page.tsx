import { requireUser } from '@/lib/auth/authz'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Showcase } from '@/components/design/Showcase'

// Żywa dokumentacja komponentów bazowych w obu motywach (sekcja 8, widok 8).
export default async function DesignPage() {
  const user = await requireUser()

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Design — komponenty bazowe</h1>
          <p className="text-sm text-muted">
            Żywa galeria w obu motywach. Przełącznik zmienia motyw aplikacji
            (zapis do konta i cookie).
          </p>
        </div>
        <ThemeToggle current={user.theme} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="light overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-surface-raised px-4 py-2 font-mono text-xs text-muted">
            Motyw jasny
          </div>
          <Showcase />
        </div>

        <div className="dark overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-surface-raised px-4 py-2 font-mono text-xs text-muted">
            Motyw ciemny
          </div>
          <Showcase />
        </div>
      </div>
    </main>
  )
}
