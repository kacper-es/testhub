import Link from 'next/link'
import { requireRolePage } from '@/lib/auth/authz'
import { Card } from '@/components/ui/Card'

export default async function AdminPage() {
  await requireRolePage(['ADMIN'])

  const sections = [
    {
      href: '/admin/templates',
      title: 'Szablony zadań',
      desc: 'Dodawanie, edycja, kolejność, dezaktywacja. Zmiany działają na żywo w otwartych wersjach.',
    },
    {
      href: '/admin/users',
      title: 'Konta',
      desc: 'Tworzenie kont z hasłem tymczasowym, reset hasła, rola, dezaktywacja.',
    },
    {
      href: '/admin/changelog',
      title: 'Log zmian',
      desc: 'Historia zmian flag i zadań z filtrami i paginacją.',
    },
  ]

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <Link href="/" className="text-sm text-muted underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Panel administratora</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:bg-surface-raised">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
